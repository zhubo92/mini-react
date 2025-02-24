export const ImmediatePriority = 1; // 立即执行的优先级, 级别最高 (用户的事件 点击事件 输入事件)
export const UserBlockingPriority = 2; // 用户阻塞级别的优先级 (滚动 拖拽事件)
export const NormalPriority = 3; // 正常的优先级 render (动画 网络请求)
export const LowPriority = 4; // 低优先级 (分析统计)
export const IdlePriority = 5;// 最低级别 的优先级, 可以被闲置的那种 (日志打印 console)

// 获取当前时间
function getCurrentTime() {
    // 精确到微秒，比 new Date() 更精确
    return performance.now();
}

// 模拟调度器
class SimpleScheduler {
    constructor() {
        this.taskQueue = [];
        // 是否有任务在执行，防止任务被执行多次
        this.isPerformingWork = false;
        const channel = new MessageChannel();
        this.port = channel.port2;
        channel.port1.onmessage = this.performWorkUntilDeadline.bind(this);
    }

    scheduleCallback(priorityLevel, callback) {
        const currentTime = getCurrentTime();
        let timeout;
        // 根据优先级设置超时时间
        // 超时时间越小，优先级越高
        switch (priorityLevel) {
            case ImmediatePriority:
                timeout = -1;
                break;
            case UserBlockingPriority:
                timeout = 250;
                break;
            case LowPriority:
                timeout = 10000;
                break;
            case IdlePriority:
                timeout = 1073741823; // 32位操作系统，v8引擎的最大值
                break;
            case NormalPriority:
            default:
                timeout = 5000;
                break;
        }
        const task = {
            callback,
            priorityLevel,
            expirationTime: currentTime + timeout, // 过期时间：直接根据当前时间加上超时时间
        }
        // 将任务加入队列
        this.push(this.taskQueue, task);
        this.schedulePerformWorkUntilDeadline();
    }

    // 通过 MessageChannel 调度执行任务
    schedulePerformWorkUntilDeadline() {
        if(!this.isPerformingWork) {
            this.isPerformingWork = true;
            // 触发 MessageChannel 调度
            this.port.postMessage(null);
        }
    }

    // 执行任务
    performWorkUntilDeadline() {
        this.isPerformingWork = true;
        this.workLoop();
        this.isPerformingWork = false;
    }

    // 任务循环
    workLoop() {
        let currentTask = this.peek(this.taskQueue);
        while(currentTask) {
            const cb = currentTask.callback;
            if(typeof cb === "function") cb();
            // 移除已完成任务
            this.pop(this.taskQueue);
            // 获取下一个任务
            currentTask = this.peek(this.taskQueue);
        }
    }

    // 向队列中添加任务
    push(queue, task) {
        queue.push(task);
        // 从小到大排序
        queue.sort((a, b) => a.expirationTime - b.expirationTime);
    }

    // 获取队列中的任务
    peek(queue) {
        return queue[0] || null;
    }

    // 从队列中移除任务
    pop(queue) {
        return queue.shift();
    }
}

export default SimpleScheduler;
