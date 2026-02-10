import React, { useState } from 'react';
import { Layout, Plus, CheckCircle2, Circle, Clock, Search, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const tasks = [
    { id: 1, title: 'Design System Update', category: 'UI/UX', priority: 'High', status: 'done' },
    { id: 2, title: 'API Integration', category: 'Backend', priority: 'Medium', status: 'pending' },
    { id: 3, title: 'Marketing Landing Page', category: 'Growth', priority: 'High', status: 'pending' },
];

export default function App() {
    return (
        <div className="min-h-screen flex">
            <div className="w-64 border-r border-white/10 p-6 flex flex-col gap-8">
                <div className="flex items-center gap-3 text-violet-500 font-bold text-xl">
                    <Layout className="w-8 h-8" />
                    <span>ZENITH</span>
                </div>
                <nav className="flex flex-col gap-2">
                    {['Dashboard', 'Tasks', 'Schedule', 'Analytics', 'Team'].map(item => (
                        <button key={item} className="px-4 py-2 rounded-lg hover:bg-white/5 text-left transition-colors text-zinc-400 hover:text-white">
                            {item}
                        </button>
                    ))}
                </nav>
            </div>

            <main className="flex-1 p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-500/10 via-zinc-950 to-zinc-950">
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Project Overview</h1>
                        <p className="text-zinc-500">Welcome back. You have 4 tasks due today.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50 w-64 text-sm" placeholder="Search projects..." />
                        </div>
                        <button className="p-2 rounded-full border border-white/10 hover:bg-white/5"><Bell className="w-5 h-5 text-zinc-400" /></button>
                    </div>
                </header>

                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tasks.map((task, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={task.id}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl hover:border-white/20 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <span className="px-3 py-1 bg-violet-500/20 text-violet-400 text-xs font-semibold rounded-full uppercase tracking-wider">
                                    {task.category}
                                </span>
                                {task.status === 'done' ? <CheckCircle2 className="text-emerald-500 w-5 h-5" /> : <Circle className="text-zinc-700 w-5 h-5" />}
                            </div>
                            <h3 className="text-lg font-medium mb-4 group-hover:text-violet-400 transition-colors">{task.title}</h3>
                            <div className="flex items-center gap-4 text-zinc-500 text-sm">
                                <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> 2 days</div>
                                <div className={`flex items-center gap-1 ${task.priority === 'High' ? 'text-rose-400' : 'text-amber-400'}`}>
                                    {task.priority}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                    <button className="border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-3 hover:bg-white/5 hover:border-white/20 transition-all text-zinc-500 hover:text-white min-h-[200px]">
                        <Plus className="w-8 h-8" />
                        <span className="font-medium">Create New Task</span>
                    </button>
                </section>
            </main>
        </div>
    );
}
