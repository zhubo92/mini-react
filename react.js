// jsx/tsx 通过 babel/swc/esbuild 编译成 React.createElement
const React = {
    createElement(type, props = {}, ...children) {
        return {
            type,
            props: {
                ...props,
                children: children.map(child => typeof child === "object" ? child : React.createTextElement(child)),
            }
        }
    },
    // 创建文本节点
    createTextElement(text) {
        return {
            type: "TEXT_ELEMENT",
            props: {
                nodeValue: text,
                children: []
            },
        }
    }
}

// 虚拟 DOM 转 fiber 结构和时间切片
let nextUnitOfWork = null; // 下一个工作单元
let winRoot = null; // 正在工作的 Fiber 树
let currentRoot = null; // 当前 Fiber 树的根
let deletions = null; // 存储需要删除的 Fiber

// 渲染函数
export function render(element, container) {
    // wipRoot 表示“正在进行的工作根”，它是 Fiber 架构中渲染任务的起点
    winRoot = {
        dom: container, // 渲染目标的 DOM 容器
        props: {
            children: [element], // 要渲染的元素（例如 React 元素）
        },
        // 旧的 fiber 树
        // 双缓冲机制（两颗 fiber 树通过 alternate 属性相互关联）
        alternate: currentRoot,
    }
    // 下一个工作单元为根节点
    // 将其设置为 wipRoot，表示渲染工作从根节点开始
    nextUnitOfWork = winRoot;
    // 清空旧的删除节点
    deletions = [];
}

// 是否不是 children 属性
function isProperty(key) {
    return key !== "children";
}

// 更新 DOM 节点属性
function updateDom(dom, oldProps, newProps) {
    // 移除旧的属性
    Object.keys(oldProps).filter(isProperty).forEach(key => {
        dom[key] = "";
    });
    // 设置新的属性
    Object.keys(newProps).filter(isProperty).forEach(key => {
        dom[key] = newProps[key];
    });
}

// 创建真实 DOM
function createDom(fiber) {
    const dom = fiber.type === "TEXT_ELEMENT" ? document.createTextNode(fiber.props.nodeValue) : document.createElement(fiber.type);
    updateDom(dom, {}, fiber.props);
    return dom;
}

// 创建 fiber 节点
function createFiber(child, parent) {
    return {
        type: child.type,
        props: child.props,
        parent,
        dom: null, // 关联的 DOM 节点
        alternate: null, // 对应的前一次 Fiber 节点
        sibling: null, // 兄弟节点
        child: null, // 子节点
        effectTag: null // 操作标记 'PLACEMENT', 'UPDATE', 'DELETION'
    };
}

// diff 算法: 将子节点与之前的 fiber 树进行比较
function reconcileChildren(fiber, children) {
    let index = 0;
    // 新树的上一个节点
    let prevSibling = null;
    // 旧的第一个子节点
    let oldFiber = fiber.alternate && fiber.alternate.child;

    while (index < children.length || oldFiber !== null) {
        const child = children[index];
        let newFiber = null;

        // 比较新旧 fiber 类型
        const sameType = oldFiber && child.type === oldFiber.type;
        // 如果是同类型的节点，复用
        if (sameType) {
            console.log("复用", child);
            newFiber = {
                type: child.type,
                props: child.props,
                parent: fiber,
                dom: oldFiber.dom,
                alternate: oldFiber,
                effectTag: "UPDATE",
            };
        }
        // 如果新节点存在，但类型不同，新增 fiber 节点
        if (!sameType && child) {
            console.log("新增", child);
            newFiber = createFiber(child, fiber);
            newFiber.effectTag = "PLACEMENT"; // 新增标记
        }
        // 如果旧节点存在，但新节点不存在，删除旧节点
        if (!sameType && oldFiber) {
            console.log("删除", oldFiber);
            oldFiber.effectTag = 'DELETION';
            deletions.push(oldFiber);
        }
        // 移动旧 fiber 指针到下一个兄弟节点
        if (oldFiber) {
            oldFiber = oldFiber.sibling;
        }
        // 将新 fiber节点插入到DOM树中
        if (index === 0) { // 将第一个子节点设置为父节点的子节点
            fiber.child = newFiber;
        } else if (child) {  // 将后续子节点作为前一个兄弟节点的兄弟
            prevSibling.sibling = newFiber;
        }
        // 更新兄弟节点
        prevSibling = newFiber;
        index++;
    }
}

// 执行单个工作单元，并返回下一个工作单元
function performUnitOfWork(fiber) {
    // 如果没有 DOM 节点，为当前 fiber 创建 DOM 节点
    if (!fiber.dom) {
        fiber.dom = createDom(fiber);
    }
    // 遍历子节点 确保每个 fiber 节点都在内存中有一个对应的 DOM 节点准备好，以便后续在提交阶段更新到实际的 DOM 树中
    reconcileChildren(fiber, fiber.props.children);
    // 返回下一个工作单元（child, sibling, or parent）
    if (fiber.child) {
        return fiber.child;
    }
    let nextFiber = fiber;
    while (nextFiber) {
        if (nextFiber.sibling) {
            // 兄弟节点不为空，返回兄弟节点
            return nextFiber.sibling;
        }
        // 兄弟节点为空，返回父节点
        nextFiber = nextFiber.parent;
    }
    return null;
}

// 提交单个 Fiber 节点
function commitWork(fiber) {
    if (!fiber) return;
    const domParent = fiber.parent.dom;
    if (fiber.effectTag === "PLACEMENT" && fiber.dom !== null) {
        domParent.appendChild(fiber.dom);
    } else if (fiber.effectTag === "UPDATE" && fiber.dom !== null) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props);
    } else if (fiber.effectTag === "DELETION") {
        domParent.removeChild(fiber.dom);
    }
    commitWork(fiber.child);
    commitWork(fiber.sibling);
}

// 提交更新到 DOM
function commitRoot() {
    // 删除需要删除的 fiber 节点
    deletions.forEach(commitWork);
    // 更新子节点
    commitWork(winRoot.child);
    // 更新旧的 fiber 树
    currentRoot = winRoot;
    // 所有的变化都操作完成了，清空状态
    winRoot = null;
}

// Fiber 调度器
// 实现将耗时任务拆分成多个小的工作单元
// deadline 表示浏览器空闲时间
function workLoop(deadline) {
    // 是一个标志，用来表示是否需要让出控制权给浏览器。如果时间快用完了，则设为 true，以便及时暂停任务，避免阻塞主线程
    let shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
        // performUnitOfWork 是一个函数，它处理当前的工作单元，并返回下一个要执行的工作单元。每次循环会更新 nextUnitOfWork 为下一个工作单元
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        //使用 deadline.timeRemaining() 来检查剩余的空闲时间。如果时间少于 1 毫秒，就设置 shouldYield 为 true，表示没有空闲时间了，就让出控制权
        shouldYield = deadline.timeRemaining() < 1;
    }
    // 当没有下一个工作单元时（nextUnitOfWork 为 null），并且有一个待提交的“工作根”（wipRoot），就会调用 commitRoot() 将最终的结果应用到 DOM 中（也就是渲染更新DOM）
    if (!nextUnitOfWork && winRoot) {
        commitRoot();
    }
    // 使用 requestIdleCallback 来安排下一个空闲时间段继续执行 workLoop，让任务在浏览器空闲时继续进行
    requestIdleCallback(workLoop);
}

// requestIdleCallback 浏览器绘制一帧 16ms 空闲的时间去执行的函数 浏览器自动执行
// 浏览器一帧做些什么
// 1. 处理事件回调函数
// 2. 处理计时器的回调函数
// 3. 开始帧
// 4. 执行 requestAnimationFrame 动画的回调函数
// 5. 计算机页面布局计算 合并到主线程
// 6. 绘制
// 7. 如果此时还有空闲时间，执行 requestIdleCallback
requestIdleCallback(workLoop);

export default React;
