const moduleRegistry = [];
if (typeof window !== 'undefined') window.moduleRegistry = moduleRegistry;

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

    constructor() {
        this.moduleId = moduleRegistry.length;
        moduleRegistry.push(this);
    }

    get(name, defaultValue) {
        if (!(name in this.vars)) {
            this.vars[name] = defaultValue;
            this.dirty = true;
        }
        return this.vars[name];
    }

    set(name, value) {
        if (this.vars[name] !== value) {
            this.vars[name] = value;
            this.dirty = true;
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
    }

    _registerUpdatable(node, item, ownerModuleId) {
        const owner = moduleRegistry[ownerModuleId];
        if (owner) {
            owner.updatables.push({ node, item, moduleId: ownerModuleId });
        }
    }

    _interpolate(text) {
        let isUpdatable = false;
        const result = text.replace(/\{(\w+)\}/g, (match, varName) => {
            isUpdatable = true;
            return (varName in this.vars) ? this.vars[varName] : '';
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

        // Handle imported module tags
        if (this.imports[item.tag]) {
            const ImportedClass = this.imports[item.tag];
            const componentInstance = new ComponentInstance(ImportedClass, item.attributes || {}, this, item.tag);

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

            const conditional = new Conditional(child.tag, condition, child.children || [], this);

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

    constructor(branchType, condition, children, ownerModule) {
        super();
        this.branchType = branchType;
        this.condition = condition;
        this.branchChildren = children;
        this.ownerModule = ownerModule;
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
            // Different branch - empty the div
            if (this.rootElement) {
                while (this.rootElement.firstChild) {
                    this.rootElement.removeChild(this.rootElement.firstChild);
                }
            }

            // Clear old branch updatables
            if (this.activeBranch) {
                this.activeBranch.updatables = [];
            }

            this.activeBranch = newBranch;

            // Fill with new branch content if any branch is active
            if (this.activeBranch && this.rootElement) {
                const [children] = this.ownerModule._buildChildren(
                    this.activeBranch.branchChildren,
                    this.activeBranch.moduleId
                );
                for (const childNode of children) {
                    this.rootElement.appendChild(childNode);
                }
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

    constructor(SourceClass, attributes, ownerModule, namespace) {
        super();
        this.sourceClass = SourceClass;
        this.ownerModule = ownerModule;
        this.namespace = namespace;

        // Create a temporary instance to get the class properties
        const template = new SourceClass();

        // Copy structure, conditions, handlers, loops, and imports from template
        this.structure = template.structure;
        this.conditions = template.conditions;
        this.handlers = template.handlers;
        this.loops = template.loops;
        this.imports = template.imports;

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
