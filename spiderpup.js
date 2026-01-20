const moduleRegistry = [];
if (typeof window !== 'undefined') window.moduleRegistry = moduleRegistry;

// Router for SPA navigation
class Router {
    routes = [];
    currentRoute = null;
    currentComponent = null;
    routerViewContainer = null;
    ownerModule = null;

    constructor(routes, ownerModule) {
        this.routes = routes || [];
        this.ownerModule = ownerModule;

        // Listen for popstate (back/forward navigation)
        window.addEventListener('popstate', () => {
            this.navigate(window.location.pathname, false);
        });
    }

    setContainer(container) {
        this.routerViewContainer = container;
        // Navigate to current path on init
        this.navigate(window.location.pathname, false);
    }

    navigate(path, pushState = true) {
        // Match route
        let matchedRoute = null;
        let params = {};

        for (const route of this.routes) {
            const match = path.match(route.pattern);
            if (match) {
                matchedRoute = route;
                // Extract params
                for (let i = 0; i < route.params.length; i++) {
                    params[route.params[i]] = match[i + 1];
                }
                break;
            }
        }

        if (!matchedRoute) {
            console.warn('No route matched for path:', path);
            return;
        }

        if (pushState) {
            window.history.pushState({}, '', path);
        }

        // Destroy current component
        if (this.currentComponent) {
            this.currentComponent.destroy();
        }

        // Clear container
        if (this.routerViewContainer) {
            while (this.routerViewContainer.firstChild) {
                this.routerViewContainer.removeChild(this.routerViewContainer.firstChild);
            }
        }

        // Create new component
        const ComponentClass = matchedRoute.component;
        this.currentComponent = new ComponentInstance(ComponentClass, params, this.ownerModule, null);
        this.currentRoute = matchedRoute;

        // Render into container
        if (this.routerViewContainer) {
            const [content] = this.currentComponent.render();
            if (content) {
                this.routerViewContainer.appendChild(content);
            }
        }
    }
}

// Global router instance
let globalRouter = null;

// Transition CSS (injected once)
const transitionStyles = `
.sp-fade-enter { opacity: 0; }
.sp-fade-enter-active { transition: opacity 0.3s ease; }
.sp-fade-leave { opacity: 1; }
.sp-fade-leave-active { opacity: 0; transition: opacity 0.3s ease; }
.sp-slide-enter { transform: translateX(100%); }
.sp-slide-enter-active { transition: transform 0.3s ease; }
.sp-slide-leave { transform: translateX(0); }
.sp-slide-leave-active { transform: translateX(-100%); transition: transform 0.3s ease; }
`;

let transitionStylesInjected = false;
function injectTransitionStyles() {
    if (transitionStylesInjected) return;
    const style = document.createElement('style');
    style.textContent = transitionStyles;
    document.head.appendChild(style);
    transitionStylesInjected = true;
}

// Error overlay for runtime errors
const errorOverlayStyles = `
.sp-error-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    font-family: monospace;
    padding: 40px;
    overflow: auto;
    z-index: 99999;
}
.sp-error-title {
    color: #ff6b6b;
    font-size: 24px;
    margin-bottom: 20px;
}
.sp-error-message {
    background: #1a1a2e;
    padding: 20px;
    border-radius: 8px;
    border-left: 4px solid #ff6b6b;
    white-space: pre-wrap;
    line-height: 1.6;
    margin-bottom: 20px;
}
.sp-error-stack {
    background: #16213e;
    padding: 15px;
    border-radius: 8px;
    font-size: 12px;
    color: #a0a0a0;
}
.sp-error-close {
    position: absolute;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: #fff;
    border: none;
    padding: 10px 20px;
    cursor: pointer;
    border-radius: 4px;
}
`;

let errorOverlayInjected = false;
function showErrorOverlay(message, stack) {
    if (!errorOverlayInjected) {
        const style = document.createElement('style');
        style.textContent = errorOverlayStyles;
        document.head.appendChild(style);
        errorOverlayInjected = true;
    }

    // Remove existing overlay
    const existing = document.querySelector('.sp-error-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'sp-error-overlay';
    overlay.innerHTML = `
        <button class="sp-error-close" onclick="this.parentElement.remove()">Dismiss</button>
        <div class="sp-error-title">⚠️ Runtime Error</div>
        <div class="sp-error-message">${escapeHtml(message)}</div>
        ${stack ? `<div class="sp-error-stack">${escapeHtml(stack)}</div>` : ''}
    `;
    document.body.appendChild(overlay);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global error handlers
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        showErrorOverlay(event.message, event.error?.stack);
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const message = reason?.message || String(reason);
        const stack = reason?.stack;
        showErrorOverlay(`Unhandled Promise Rejection: ${message}`, stack);
    });
}

// Event class for bubbling events
class SpiderpupEvent {
    constructor(name, data, source) {
        this.name = name;
        this.data = data;
        this.source = source;
        this.propagationStopped = false;
    }

    stopPropagation() {
        this.propagationStopped = true;
    }
}

class Module {
    vars = {};
    dirty = false;
    conditions = [];
    handlers = [];
    loops = [];
    moduleId = null;
    updatables = [];
    eventHandlers = [];
    imports = {};
    watchers = {};
    refs = {};
    bindings = [];  // For two-way binding
    classBindings = [];  // For class:* bindings
    styleBindings = [];  // For style:* bindings
    receivers = {};  // For broadcast/receive messaging
    parentModule = null;  // For event bubbling
    eventListeners = {};  // For on/emit events

    constructor() {
        this.moduleId = moduleRegistry.length;
        moduleRegistry.push(this);
    }

    // Register an event listener (for bubbling events)
    on(eventName, handler) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(handler);
    }

    // Remove an event listener
    off(eventName, handler) {
        if (!this.eventListeners[eventName]) return;
        if (handler) {
            this.eventListeners[eventName] = this.eventListeners[eventName].filter(h => h !== handler);
        } else {
            delete this.eventListeners[eventName];
        }
    }

    // Emit an event that bubbles up to parent modules
    emit(eventName, data) {
        const event = new SpiderpupEvent(eventName, data, this);
        this._bubbleEvent(event);
        return event;
    }

    // Internal: bubble event up the parent chain
    _bubbleEvent(event) {
        // Start with parent (don't handle on self)
        let current = this.parentModule;

        while (current && !event.propagationStopped) {
            // Check if this module has listeners for this event
            if (current.eventListeners && current.eventListeners[event.name]) {
                for (const handler of current.eventListeners[event.name]) {
                    // Call handler with event
                    const result = handler.call(current, event);
                    // If handler returns false, stop propagation
                    if (result === false) {
                        event.stopPropagation();
                    }
                    if (event.propagationStopped) break;
                }
            }
            // Move up to next parent
            current = current.parentModule;
        }
    }

    // Register a receiver for a channel
    receive(channel, callback) {
        if (!this.receivers[channel]) {
            this.receivers[channel] = [];
        }
        this.receivers[channel].push(callback);
    }

    // Broadcast a message to all modules except self
    broadcast(channel, data) {
        for (const module of moduleRegistry) {
            // Skip self
            if (module.moduleId === this.moduleId) continue;
            // Skip modules without receivers for this channel
            if (!module.receivers || !module.receivers[channel]) continue;
            // Call all receivers for this channel
            for (const callback of module.receivers[channel]) {
                callback.call(module, data, this);
            }
        }
    }

    get(name, defaultValue) {
        if (!(name in this.vars)) {
            this.vars[name] = defaultValue;
            this.dirty = true;
        }
        return this.vars[name];
    }

    set(name, value) {
        const oldValue = this.vars[name];
        if (oldValue !== value) {
            this.vars[name] = value;
            this.dirty = true;
            // Call watcher if defined
            if (this.watchers && this.watchers[name]) {
                this.watchers[name].call(this, value, oldValue);
            }
        }
    }

    buildElements(structure) {
        const [elements] = this._buildChildren(structure.elements || []);
        return elements;
    }

    initUI() {
        const elements = this.buildElements(this.structure);
        for (const el of elements) {
            document.body.appendChild(el);
        }
        // Call onMount lifecycle hook
        if (this.onMount) {
            this.onMount.call(this);
        }
    }

    refresh() {
        for (const updatable of this.updatables) {
            // Refresh child modules (like Conditionals)
            const moduleId = updatable.moduleId;
            if (moduleId !== undefined && moduleId !== this.moduleId) {
                const module = moduleRegistry[moduleId];
                if (module) {
                    module.refresh();
                }
            }
            // Update text nodes with new interpolated values
            if (updatable.node && updatable.item && updatable.item.type === 'text') {
                const [newText] = this._interpolate(updatable.item.content);
                updatable.node.textContent = newText;
            }
        }
        // Update two-way bindings (sync external changes to inputs)
        for (const binding of this.bindings) {
            const { node, varName } = binding;
            const value = this.vars[varName];
            if (node.type === 'checkbox') {
                node.checked = !!value;
            } else {
                node.value = value ?? '';
            }
        }
        // Update class bindings
        for (const cb of this.classBindings) {
            const { node, className, condition } = cb;
            if (condition.call(this)) {
                node.classList.add(className);
            } else {
                node.classList.remove(className);
            }
        }
        // Update style bindings
        for (const sb of this.styleBindings) {
            const { node, styleProp, getter } = sb;
            node.style[styleProp] = getter.call(this);
        }
    }

    _registerUpdatable(node, item, ownerModuleId) {
        const owner = moduleRegistry[ownerModuleId];
        if (owner) {
            owner.updatables.push({ node, item, moduleId: ownerModuleId });
        }
    }

    destroy() {
        // Call onDestroy lifecycle hook
        if (this.onDestroy) {
            this.onDestroy.call(this);
        }
        // Remove event listeners
        for (const { node, eventName, handler } of this.eventHandlers) {
            node.removeEventListener(eventName, handler);
        }
        this.eventHandlers = [];
        this.bindings = [];
        this.classBindings = [];
        this.styleBindings = [];
        this.updatables = [];
    }

    _interpolate(text) {
        let isUpdatable = false;
        const result = text.replace(/\{(\w+)\}/g, (match, varName) => {
            isUpdatable = true;
            // Check vars first
            if (varName in this.vars) {
                return this.vars[varName];
            }
            // Check for computed property getter
            const getterName = `get_${varName}`;
            if (typeof this[getterName] === 'function') {
                return this[getterName]();
            }
            return '';
        });
        return [result, isUpdatable];
    }

    _buildNode(item, ownerModuleId) {
        if (item.type === 'text') {
            const [text, isUpdatable] = this._interpolate(item.content);
            const node = document.createTextNode(text);
            if (isUpdatable) {
                this._registerUpdatable(node, item, ownerModuleId);
            }
            return [node, isUpdatable];
        }

        // Handle if/elseif/else - these are processed as a group by _buildChildren
        if (item.tag === 'if' || item.tag === 'elseif' || item.tag === 'else') {
            return [null, false];
        }

        // Handle for loops - these are processed by _buildChildren
        if (item.tag === 'for') {
            return [null, false];
        }

        // Handle slot tag - render slot children from owner module's context
        if (item.tag === 'slot') {
            if (this.slotChildren && this.slotChildren.length > 0) {
                const wrapper = document.createElement('span');
                wrapper.setAttribute('data-slot', 'true');
                // Render slot children using owner module's context
                const [children] = this.ownerModule._buildChildren(this.slotChildren, this.ownerModule.moduleId);
                for (const childNode of children) {
                    wrapper.appendChild(childNode);
                }
                return [wrapper, true];
            }
            return [null, false];
        }

        // Handle router-view tag
        if (item.tag === 'router-view') {
            const container = document.createElement('div');
            container.setAttribute('data-router-view', 'true');
            // Initialize router if we have routes
            if (this.routes && !globalRouter) {
                globalRouter = new Router(this.routes, this);
                globalRouter.setContainer(container);
            }
            return [container, true];
        }

        // Handle link tag (router link)
        if (item.tag === 'link') {
            const anchor = document.createElement('a');
            const toPath = item.attributes?._to || '/';
            anchor.href = toPath;
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                if (globalRouter) {
                    globalRouter.navigate(toPath);
                }
            });
            // Build children
            const [children] = this._buildChildren(item.children || [], ownerModuleId);
            for (const childNode of children) {
                anchor.appendChild(childNode);
            }
            return [anchor, false];
        }

        // Handle imported module tags
        if (this.imports[item.tag]) {
            const ImportedClass = this.imports[item.tag];
            const slotChildren = item.children || [];
            const componentInstance = new ComponentInstance(ImportedClass, item.attributes || {}, this, item.tag, slotChildren);

            // Handle ref for components
            if (item.attributes && item.attributes._ref) {
                this.refs[item.attributes._ref] = componentInstance;
            }

            // Register as updatable with parent module
            const owner = moduleRegistry[ownerModuleId];
            if (owner) {
                owner.updatables.push({ node: null, item: null, moduleId: componentInstance.moduleId });
            }

            return componentInstance.render();
        }

        const node = document.createElement(item.tag);
        for (const [attr, value] of Object.entries(item.attributes || {})) {
            if (attr.startsWith('_on') && attr.endsWith('Index')) {
                // Event handler from handlers array
                const handlerInfo = this.handlers[value];
                if (handlerInfo) {
                    const eventName = handlerInfo.event.slice(2).toLowerCase();
                    const originalHandler = handlerInfo.handler;
                    const module = this;
                    const wrappedHandler = function(event) {
                        originalHandler.call(module, module);
                        module.refresh();
                    };
                    this.eventHandlers.push({ node, eventName, handler: wrappedHandler });
                    node.addEventListener(eventName, wrappedHandler);
                }
            } else if (attr === '_bind') {
                // Two-way binding
                const varName = value;
                const module = this;
                // Set initial value
                if (node.type === 'checkbox') {
                    node.checked = !!this.vars[varName];
                } else {
                    node.value = this.vars[varName] ?? '';
                }
                // Add input listener
                const inputHandler = function(event) {
                    const newValue = node.type === 'checkbox' ? node.checked : node.value;
                    module.set(varName, newValue);
                    module.refresh();
                };
                node.addEventListener('input', inputHandler);
                this.eventHandlers.push({ node, eventName: 'input', handler: inputHandler });
                // Register for refresh updates
                this.bindings.push({ node, varName });
            } else if (attr === '_ref') {
                // Store ref
                this.refs[value] = node;
            } else if (attr.startsWith('_class:') && attr.endsWith('Index')) {
                // Class binding
                const className = attr.slice(7, -5); // Remove "_class:" prefix and "Index" suffix
                const handlerInfo = this.handlers[value];
                if (handlerInfo) {
                    const condition = handlerInfo.handler;
                    // Apply initial class state
                    if (condition.call(this)) {
                        node.classList.add(className);
                    }
                    // Register for refresh updates
                    this.classBindings.push({ node, className, condition });
                }
            } else if (attr.startsWith('_style:') && attr.endsWith('Index')) {
                // Style binding
                const styleProp = attr.slice(7, -5); // Remove "_style:" prefix and "Index" suffix
                const handlerInfo = this.handlers[value];
                if (handlerInfo) {
                    const getter = handlerInfo.handler;
                    // Apply initial style
                    node.style[styleProp] = getter.call(this);
                    // Register for refresh updates
                    this.styleBindings.push({ node, styleProp, getter });
                }
            } else if (!attr.startsWith('_')) {
                node.setAttribute(attr, value);
            }
        }
        let isUpdatable = false;
        const [children, childrenUpdatable] = this._buildChildren(item.children || [], ownerModuleId);
        for (const childNode of children) {
            node.appendChild(childNode);
        }
        if (childrenUpdatable) isUpdatable = true;
        if (isUpdatable) {
            node.setAttribute('data-module-id', ownerModuleId);
        }
        return [node, isUpdatable];
    }

    _buildChildren(children, ownerModuleId) {
        if (ownerModuleId === undefined) {
            ownerModuleId = this.moduleId;
        }
        const result = [];
        let isUpdatable = false;
        let i = 0;

        while (i < children.length) {
            const child = children[i];

            if (child.tag === 'if') {
                // Build linked Conditional chain
                const conditionalChain = this._buildConditionalChain(children, i, ownerModuleId);
                i = conditionalChain.nextIndex;

                // Evaluate and render the chain
                const [branchNode, branchUpdatable] = conditionalChain.head.evaluate(this);
                if (branchNode) {
                    result.push(branchNode);
                    if (branchUpdatable) isUpdatable = true;
                }
            } else if (child.tag === 'for') {
                // Build Loop
                const itemsIndex = child.attributes?._itemsIndex;
                const items = itemsIndex !== undefined ? this.loops[itemsIndex] : [];

                const loop = new Loop(items, child.children || [], this);

                // Register the loop as updatable with parent module
                const owner = moduleRegistry[ownerModuleId];
                if (owner) {
                    owner.updatables.push({ node: null, item: null, moduleId: loop.moduleId });
                }

                // Render the loop
                const [loopNode, loopUpdatable] = loop.render();
                if (loopNode) {
                    result.push(loopNode);
                    if (loopUpdatable) isUpdatable = true;
                }
                i++;
            } else {
                const [node, nodeUpdatable] = this._buildNode(child, ownerModuleId);
                if (node) {
                    result.push(node);
                    if (nodeUpdatable) isUpdatable = true;
                }
                i++;
            }
        }

        return [result, isUpdatable];
    }

    _buildConditionalChain(children, startIndex, ownerModuleId) {
        let i = startIndex;
        let head = null;
        let current = null;
        let headTransition = null;

        while (i < children.length) {
            const child = children[i];
            if (child.tag !== 'if' && child.tag !== 'elseif' && child.tag !== 'else') {
                break;
            }
            if (child.tag !== 'if' && head === null) {
                break;  // elseif/else without preceding if
            }

            const condIndex = child.attributes?._conditionIndex;
            const condition = condIndex !== undefined ? this.conditions[condIndex] : null;
            const transition = child.attributes?._transition || null;

            // Store head transition for all branches
            if (child.tag === 'if') {
                headTransition = transition;
            }

            const conditional = new Conditional(child.tag, condition, child.children || [], this, headTransition);

            if (head === null) {
                head = conditional;
                // Register the head conditional as updatable with parent module
                const owner = moduleRegistry[ownerModuleId];
                if (owner) {
                    owner.updatables.push({ node: null, item: null, moduleId: conditional.moduleId });
                }
            } else {
                current.nextBranch = conditional;
            }
            current = conditional;

            i++;
            if (child.tag === 'else') {
                break;
            }
        }

        return { head, nextIndex: i };
    }
}

class Conditional extends Module {
    branchType = null;
    condition = null;
    branchChildren = [];
    nextBranch = null;
    rootElement = null;
    activeBranch = null;
    ownerModule = null;
    transition = null;

    constructor(branchType, condition, children, ownerModule, transition = null) {
        super();
        this.branchType = branchType;
        this.condition = condition;
        this.branchChildren = children;
        this.ownerModule = ownerModule;
        this.parentModule = ownerModule;  // For event bubbling
        this.transition = transition;
        if (transition) {
            injectTransitionStyles();
        }
    }

    evaluate(module) {
        // Check if this branch matches
        if (this.branchType === 'else') {
            this.activeBranch = this;
            return this._render(module);
        }

        if (this.condition && this.condition.call(module)) {
            this.activeBranch = this;
            return this._render(module);
        }

        // Try next branch
        if (this.nextBranch) {
            const result = this.nextBranch.evaluate(module);
            this.activeBranch = this.nextBranch.activeBranch;
            return result;
        }

        this.activeBranch = null;
        return [null, false];
    }

    _selectBranch(module) {
        // Determine which branch should be active
        if (this.branchType === 'else') {
            return this;
        }

        if (this.condition && this.condition.call(module)) {
            return this;
        }

        if (this.nextBranch) {
            return this.nextBranch._selectBranch(module);
        }

        return null;
    }

    refresh() {
        const newBranch = this._selectBranch(this.ownerModule);

        if (newBranch === this.activeBranch) {
            // Same branch - refresh its updatables
            if (this.activeBranch) {
                for (const updatable of this.activeBranch.updatables) {
                    const moduleId = updatable.moduleId;
                    if (moduleId !== undefined && moduleId !== this.activeBranch.moduleId) {
                        const module = moduleRegistry[moduleId];
                        if (module) {
                            module.refresh();
                        }
                    }
                    // Update text nodes with new interpolated values (using ownerModule's vars)
                    if (updatable.node && updatable.item && updatable.item.type === 'text') {
                        const [newText] = this.ownerModule._interpolate(updatable.item.content);
                        updatable.node.textContent = newText;
                    }
                }
            }
        } else {
            // Different branch - handle transition
            const transition = this.transition;

            const doSwitch = () => {
                // Clear old branch updatables
                if (this.activeBranch) {
                    this.activeBranch.updatables = [];
                }

                this.activeBranch = newBranch;

                // Empty the div
                if (this.rootElement) {
                    while (this.rootElement.firstChild) {
                        this.rootElement.removeChild(this.rootElement.firstChild);
                    }
                }

                // Fill with new branch content if any branch is active
                if (this.activeBranch && this.rootElement) {
                    const [children] = this.ownerModule._buildChildren(
                        this.activeBranch.branchChildren,
                        this.activeBranch.moduleId
                    );
                    for (const childNode of children) {
                        this.rootElement.appendChild(childNode);
                    }

                    // Apply enter transition
                    if (transition) {
                        this.rootElement.classList.add(`sp-${transition}-enter`);
                        this.rootElement.classList.add(`sp-${transition}-enter-active`);
                        requestAnimationFrame(() => {
                            this.rootElement.classList.remove(`sp-${transition}-enter`);
                            setTimeout(() => {
                                this.rootElement.classList.remove(`sp-${transition}-enter-active`);
                            }, 300);
                        });
                    }
                }
            };

            // Apply leave transition if exists
            if (transition && this.rootElement && this.rootElement.firstChild) {
                this.rootElement.classList.add(`sp-${transition}-leave`);
                this.rootElement.classList.add(`sp-${transition}-leave-active`);
                setTimeout(doSwitch, 300);
            } else {
                doSwitch();
            }
        }
    }

    _render(module) {
        const wrapper = document.createElement('div');
        this.rootElement = wrapper;
        // Conditional div is always updatable
        wrapper.setAttribute('data-module-id', this.moduleId);
        const [children] = module._buildChildren(this.branchChildren, this.moduleId);
        for (const childNode of children) {
            wrapper.appendChild(childNode);
        }
        return [wrapper, true];
    }
}

class ComponentInstance extends Module {
    rootElement = null;
    ownerModule = null;
    sourceClass = null;
    namespace = null;
    slotChildren = [];

    constructor(SourceClass, attributes, ownerModule, namespace, slotChildren = []) {
        super();
        this.sourceClass = SourceClass;
        this.ownerModule = ownerModule;
        this.parentModule = ownerModule;  // For event bubbling
        this.namespace = namespace;
        this.slotChildren = slotChildren;

        // Create a temporary instance to get the class properties
        const template = new SourceClass();

        // Copy structure, conditions, handlers, loops, imports, and watchers from template
        this.structure = template.structure;
        this.conditions = template.conditions;
        this.handlers = template.handlers;
        this.loops = template.loops;
        this.imports = template.imports;
        this.watchers = template.watchers || {};

        // Copy lifecycle hooks
        if (template.onMount) this.onMount = template.onMount;
        if (template.onDestroy) this.onDestroy = template.onDestroy;

        // Copy computed property getters from template prototype
        const proto = Object.getPrototypeOf(template);
        const protoProps = Object.getOwnPropertyNames(proto);
        for (const prop of protoProps) {
            if (prop.startsWith('get_') && typeof template[prop] === 'function') {
                this[prop] = template[prop].bind(this);
            }
        }

        // Initialize vars from template defaults
        for (const [name, value] of Object.entries(template.vars)) {
            this.vars[name] = value;
        }

        // Override vars with attributes from the tag
        for (const [attr, value] of Object.entries(attributes)) {
            if (!attr.startsWith('_')) {
                this.vars[attr] = value;
            }
        }
    }

    render() {
        const wrapper = document.createElement('div');
        this.rootElement = wrapper;
        wrapper.setAttribute('data-module-id', this.moduleId);
        if (this.namespace) {
            wrapper.classList.add(this.namespace);
        }

        const [children] = this._buildChildren(this.structure.elements || [], this.moduleId);
        for (const childNode of children) {
            wrapper.appendChild(childNode);
        }

        // Call onMount lifecycle hook after DOM is ready
        if (this.onMount) {
            setTimeout(() => this.onMount.call(this), 0);
        }

        return [wrapper, true];
    }

    refresh() {
        for (const updatable of this.updatables) {
            const moduleId = updatable.moduleId;
            if (moduleId !== undefined && moduleId !== this.moduleId) {
                const module = moduleRegistry[moduleId];
                if (module) {
                    module.refresh();
                }
            }
            if (updatable.node && updatable.item && updatable.item.type === 'text') {
                const [newText] = this._interpolate(updatable.item.content);
                updatable.node.textContent = newText;
            }
        }
    }
}

class Loop extends Module {
    rootElement = null;
    ownerModule = null;
    items = null;
    loopChildren = [];

    constructor(items, children, ownerModule) {
        super();
        this.items = items;
        this.loopChildren = children;
        this.ownerModule = ownerModule;
        this.parentModule = ownerModule;  // For event bubbling
    }

    _getItems() {
        // items can be an array or a function that returns an array
        if (typeof this.items === 'function') {
            return this.items.call(this.ownerModule);
        }
        return this.items || [];
    }

    render() {
        const wrapper = document.createElement('div');
        this.rootElement = wrapper;
        wrapper.setAttribute('data-module-id', this.moduleId);

        const items = this._getItems();
        for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            this._renderIteration(wrapper, item, idx);
        }

        return [wrapper, true];
    }

    _renderIteration(container, item, idx) {
        for (const child of this.loopChildren) {
            const node = this._buildLoopNode(child, item, idx);
            if (node) {
                container.appendChild(node);
            }
        }
    }

    _buildLoopNode(child, item, idx) {
        if (child.type === 'text') {
            const [text] = this.ownerModule._interpolate(child.content);
            return document.createTextNode(text);
        }

        const node = document.createElement(child.tag);

        for (const [attr, value] of Object.entries(child.attributes || {})) {
            if (attr === '_textContentIndex') {
                // textContent is a function (this, item, idx) => string
                const handlerInfo = this.ownerModule.handlers[value];
                if (handlerInfo && typeof handlerInfo.handler === 'function') {
                    node.textContent = handlerInfo.handler.call(this.ownerModule, this.ownerModule, item, idx);
                    // Store for refresh
                    this.updatables.push({ node, handlerInfo, item, idx });
                }
            } else if (!attr.startsWith('_')) {
                node.setAttribute(attr, value);
            }
        }

        // Recursively build children
        for (const grandchild of (child.children || [])) {
            const childNode = this._buildLoopNode(grandchild, item, idx);
            if (childNode) {
                node.appendChild(childNode);
            }
        }

        return node;
    }

    refresh() {
        // Re-evaluate items and rebuild if needed
        const items = this._getItems();

        // Clear existing content
        while (this.rootElement.firstChild) {
            this.rootElement.removeChild(this.rootElement.firstChild);
        }
        this.updatables = [];

        // Rebuild
        for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            this._renderIteration(this.rootElement, item, idx);
        }
    }
}
