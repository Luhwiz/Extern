import React from 'react';
import { motion } from 'framer-motion';

export default function TaskCard({ task }) {
    return (
        <motion.div whileHover={{ scale: 1.02 }} className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-2xl cursor-pointer">
            <p className="text-sm font-medium">{task.title}</p>
        </motion.div>
    );
}
