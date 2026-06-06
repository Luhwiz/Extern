import React, { useState } from 'react';
import { FiX, FiCheck, FiPocket, FiZap, FiShield } from 'react-icons/fi';
import './PricingPlans.css';

const PricingPlans = ({ onClose, userEmail }) => {
    const [loading, setLoading] = useState(false);

    const plans = [
        {
            id: 'starter',
            name: 'Starter',
            price: 20,
            prompts: 150,
            features: [
                '150 AI Prompts',
                'Standard Support',
                'Basic AI Models',
                'Project Export'
            ],
            icon: <FiPocket size={24} />,
            color: '#3b82f6'
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 50,
            prompts: 350,
            features: [
                '350 AI Prompts',
                'Priority Support',
                'Advanced AI Models',
                'Team Collaboration',
                'Custom Components'
            ],
            icon: <FiZap size={24} />,
            color: '#10b981',
            popular: true
        },
        {
            id: 'premium',
            name: 'Unlimited',
            price: 300,
            prompts: 'Unlimited',
            features: [
                'Unlimited AI Prompts',
                '24/7 Dedicated Support',
                'All AI Models Included',
                'Enterprise Security',
                'Custom Branding',
                'Early Access Features'
            ],
            icon: <FiShield size={24} />,
            color: '#8b5cf6',
            premium: true
        }
    ];

    const handleBuy = async (plan) => {
        alert(`Subscriptions are currently in development. We are not accepting payments for the ${plan.name} plan at this time. Check back later!`);
    };

    return (
        <div className="pricing-overlay" onClick={onClose}>
            <div className="pricing-modal" onClick={e => e.stopPropagation()}>
                <button className="close-pricing" onClick={onClose}>
                    <FiX size={24} />
                </button>

                <div className="pricing-header">
                    <h2>Upgrade Your Experience</h2>
                    <p>Choose the plan that fits your coding needs. This is a secure sandbox test.</p>
                </div>

                <div className="pricing-cards">
                    {plans.map(plan => (
                        <div
                            key={plan.id}
                            className={`pricing-card ${plan.popular ? 'popular' : ''} ${plan.premium ? 'premium' : ''}`}
                        >
                            {plan.popular && <div className="popular-badge">MOST POPULAR</div>}

                            <div className="card-header">
                                <div style={{ color: plan.color, marginBottom: '12px' }}>{plan.icon}</div>
                                <h3>{plan.name}</h3>
                            </div>

                            <div className="price">
                                <span className="currency">$</span>
                                <span className="amount">{plan.price}</span>
                                <span className="period">/month</span>
                            </div>

                            <ul className="features">
                                {plan.features.map((feature, index) => (
                                    <li key={index}>
                                        <FiCheck size={16} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <button
                                className="buy-button"
                                onClick={() => handleBuy(plan)}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : `Get ${plan.name}`}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PricingPlans;
