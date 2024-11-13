// src/progress-util.js
import chalk from 'chalk';

class ProgressIndicator {
    constructor() {
        this.startTime = null;
        this.currentTask = null;
        this.subtasks = new Map();
    }

    start(task) {
        this.startTime = Date.now();
        this.currentTask = task;
        this.subtasks.clear();
        console.log(chalk.blue(`\n🚀 Starting: ${task}`));
    }

    update(message, current, total) {
        const percentage = Math.round((current / total) * 100);
        const bar = this.getProgressBar(percentage);
        process.stdout.write(`\r${chalk.cyan('→')} ${message}: ${bar} ${percentage}% (${current}/${total})`);
        if (current === total) {
            process.stdout.write('\n');
        }
    }

    addSubtask(name) {
        this.subtasks.set(name, {
            startTime: Date.now(),
            completed: false
        });
        console.log(chalk.cyan(`\n  ├─ Starting: ${name}`));
    }

    completeSubtask(name) {
        const task = this.subtasks.get(name);
        if (task && !task.completed) {
            const duration = ((Date.now() - task.startTime) / 1000).toFixed(2);
            console.log(chalk.green(`  └─ Completed: ${name} (${duration}s)`));
            task.completed = true;
        }
    }

    finish() {
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        console.log(chalk.green(`\n✨ Completed: ${this.currentTask} (${duration}s)\n`));

        // Check for uncompleted subtasks
        for (const [name, task] of this.subtasks.entries()) {
            if (!task.completed) {
                this.warn(`Subtask not completed: ${name}`);
            }
        }
    }

    error(message) {
        console.log(chalk.red(`\n❌ Error: ${message}`));
    }

    warn(message) {
        console.log(chalk.yellow(`\n⚠️  Warning: ${message}`));
    }

    getProgressBar(percentage, length = 20) {
        const filled = Math.round((percentage / 100) * length);
        const empty = length - filled;
        return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    }

    // Helper to format bytes to human-readable size
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    // Helper to format time duration
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }
}

// Export a singleton instance
export default new ProgressIndicator();