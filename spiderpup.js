const moduleRegistry = [];

class Module {
    vars = {};
    dirty = false;
    conditions = [];
    moduleId = null;
    updatables = [];
    eventHandlers = [];

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
            const moduleId = updatable.moduleId;
            if (moduleId !== undefined && moduleId !== this.moduleId) {
                const module = moduleRegistry[moduleId];
                if (module) {
                    module.refresh();
                }
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

        const node = document.createElement(item.tag);
        for (const [attr, value] of Object.entries(item.attributes || {})) {
            if (attr.startsWith('on')) {
                // Event handler attribute
                const eventName = attr.slice(2).toLowerCase();
                const originalHandler = eval(value);
                const module = this;
                const wrappedHandler = function(event) {
                    originalHandler.call(module, module);
                    module.refresh();
                };
                this.eventHandlers.push({ node, eventName, handler: wrappedHandler });
                node.addEventListener(eventName, wrappedHandler);
                debugger;
            } else {
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
