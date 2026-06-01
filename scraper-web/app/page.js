"use client";

import { useState, useEffect } from "react";

const categories = [
    "net development", "3d printing", "ai agent development", "asp net", "accounts",
    "acting", "aerospace", "agriculture and food engineering", "analytics", "anchoring",
    "android app development", "angular js development", "animation", "architecture",
    "artificial intelligence", "audio making editing", "auditing", "automobile engineering",
    "backend development", "bank", "big data", "bioinformatics", "biology", "biotech",
    "blockchain development", "blogging", "brand management", "business development", "mba",
    "ca articleship", "cad design", "civil", "cloud computing", "computer science",
    "computer vision", "cyber security", "data entry", "data science", "database building",
    "electrical", "flutter development", "front end development", "full stack development",
    "java", "javascript development", "mlops engineering", "machine learning",
    "natural language processing", "node js development", "seo", "software development",
    "software testing", "web development", "wordpress development"
].sort();

const formatName = (str) => {
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function ScraperPage() {
    const [selectedCategory, setSelectedCategory] = useState("");
    const [loading, setLoading] = useState(false);
    const [statusVisible, setStatusVisible] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);
    const [toastType, setToastType] = useState("success"); // 'success' or 'error'
    const [toastMessage, setToastMessage] = useState("");
    const [promptData, setPromptData] = useState(null);
    const [isPolling, setIsPolling] = useState(false);

    useEffect(() => {
        let interval;
        if (isPolling) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('/api/scrape/status');
                    const data = await res.json();
                    
                    if (data.status === 'waiting_input') {
                        setPromptData({ question: data.question, options: data.options });
                        setStatusMessage('Waiting for user input...');
                    } else if (data.status === 'running') {
                        setPromptData(null);
                        setStatusMessage('Scraping in progress. Please check terminal/browser window.');
                    } else if (data.status === 'not_running') {
                        setIsPolling(false);
                        setLoading(false);
                        setStatusMessage('Scraper stopped.');
                    }
                } catch (e) {
                    console.error("Failed to poll status", e);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [isPolling]);

    const handleAnswerSubmit = async (answer) => {
        try {
            await fetch('/api/scrape/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer })
            });
            setPromptData(null);
            setStatusMessage('Resuming scraper...');
        } catch (e) {
            showToast("Failed to submit answer", "error");
        }
    };

    const showToast = (message, type) => {
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 5000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCategory) return;

        setLoading(true);
        setStatusVisible(true);
        setStatusMessage("Initializing bot...");

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: selectedCategory })
            });

            const data = await response.json();

            if (data.success) {
                showToast(data.message || 'Scraper started successfully!', 'success');
                setStatusMessage('Scraping in progress. Please check terminal/browser window.');
                setIsPolling(true);
            } else {
                throw new Error(data.message || 'Failed to start scraper');
            }
        } catch (error) {
            showToast(error.message, 'error');
            setStatusMessage('Error starting scraper.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="background-elements">
                <div className="glow-orb orb-1"></div>
                <div className="glow-orb orb-2"></div>
            </div>

            <main className="container">
                <div className="glass-panel">
                    <header className="header">
                        <div className="logo">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="url(#paint0_linear)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 8L12 16M8 12L16 12" stroke="url(#paint1_linear)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <defs>
                                    <linearGradient id="paint0_linear" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#3B82F6"/>
                                        <stop offset="1" stopColor="#8B5CF6"/>
                                    </linearGradient>
                                    <linearGradient id="paint1_linear" x1="8" y1="8" x2="16" y2="16" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#3B82F6"/>
                                        <stop offset="1" stopColor="#8B5CF6"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                            <h1>AutoScraper Pro</h1>
                        </div>
                        <p className="subtitle">Automated Internshala Application Bot</p>
                    </header>

                    <form onSubmit={handleSubmit} className="form-container">
                        <div className="input-group">
                            <label htmlFor="category">Internship Category</label>
                            <div className="select-wrapper">
                                <select 
                                    id="category" 
                                    value={selectedCategory} 
                                    onChange={(e) => setSelectedCategory(e.target.value)} 
                                    required
                                >
                                    <option value="" disabled>Select a category...</option>
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>{formatName(cat)}</option>
                                    ))}
                                </select>
                                <svg className="select-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 9L12 15L18 9" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>

                        <button type="submit" className="primary-btn" disabled={loading}>
                            <span className={`btn-text ${loading ? 'hidden' : ''}`}>Start Scraping</span>
                            {loading && <div className="loader"></div>}
                        </button>
                    </form>
                    
                    <div className={`status-container ${!statusVisible ? 'hidden' : ''}`}>
                        <div className={`status-indicator ${loading ? 'running' : ''}`} style={(!loading && toastType === 'error') ? { background: 'var(--error)', boxShadow: '0 0 10px var(--error)' } : {}}></div>
                        <p id="status-message">{statusMessage}</p>
                    </div>
                </div>
            </main>

            <div className={`toast ${toastVisible ? 'show' : ''}`}>
                <div className="toast-content">
                    {toastType === 'success' ? (
                        <svg className="toast-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    ) : (
                        <svg className="toast-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    )}
                    <p id="toast-message">{toastMessage}</p>
                </div>
            </div>

            {promptData && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel">
                        <h3>Action Required</h3>
                        <p>{promptData.question}</p>
                        <div className="options-container">
                            {promptData.options.map(opt => (
                                <button key={opt} type="button" className="option-btn" onClick={() => handleAnswerSubmit(opt)}>
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
