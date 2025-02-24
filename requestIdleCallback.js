const ImmediatePriority = 1; // 立即执行的优先级, 级别最高 用户的事件 点击事件 输入事件
const UserBlockingPriority = 2; // 用户阻塞级别的优先级 滚动 拖拽事件
const NormalPriority = 3; // 正常的优先级 render 动画 网络请求
const LowPriority = 4; // 低优先级 分析统计
const IdlePriority = 5;// 最低级别 的优先级, 可以被闲置的那种 日志打印 console

// 获取当前时间
function getCurrentTime() {
    // 精确到微秒
    return performance.now();
}

class SimpleScheduler {
    constructor() {
        this.taskQueue = [];
        // 是否有任务在执行，防止任务被执行多次
        this.isPerformingWork = false;
        const channel = new MessageChannel();
        this.port = channel.port2;
        channel.port1.onmessage = this.performWorkUnitDeaLine.bind(this);
    }

    scheduleCallback(priorityLevel, callback) {
        const curTime = getCurrentTime();
        let timeout;
        // 根据优先级设置超时时间
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
                timeout = 1073741823;
                break;
            case NormalPriority:
            default:
                timeout = 5000;
                break;
        }
        const task = {
            callback,
            priorityLevel,
            expirationTime: priorityLevel
        }
        // 触发任务
        this.port.postMessage(null);
    }

    performWorkUnitDeaLine() {
        console.log(this, "执行任务");
        this.workLoop();
    }

    workLoop() {}
}

const s = new SimpleScheduler();
s.scheduleCallback(UserBlockingPriority, () => {
    console.log("3");
});
s.scheduleCallback(ImmediatePriority, () => {
    console.log("1");
});
s.scheduleCallback(ImmediatePriority, () => {
    console.log("2");
});
