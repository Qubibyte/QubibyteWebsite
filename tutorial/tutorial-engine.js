// Tutorial Engine
// This script handles content rendering, navigation, quizzes, visual simulations, and the final exam.

// --- Global State ---
let currentSection = 0;
let currentSubsection = 0;
let activeVisualizers = []; // Track active instances to clean up WebGL contexts
let currentExamQuestions = []; // Stores the randomized questions for the current exam session

// --- Helper Functions ---
function scrollToTop() {
    // Scroll container (Desktop)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;

    // Scroll Window (Mobile)
    window.scrollTo(0, 0);
}

function toggleSidebar(forceState) {
    const menu = document.getElementById('sidebar-menu');
    if (menu) {
        if (forceState === false) {
            menu.classList.remove('show');
        } else {
            menu.classList.toggle('show');
        }
    }
}

// --- Persistence (localStorage) ---
function saveState() {
    localStorage.setItem('qubibyte_tutorial_state', JSON.stringify({
        section: currentSection,
        sub: currentSubsection
    }));
}

function loadState() {
    const saved = localStorage.getItem('qubibyte_tutorial_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Validate bounds
            if (parsed.section >= 0 && parsed.section < tutorialData.length) {
                return { s: parsed.section, sub: parsed.sub };
            }
        } catch (e) {
            console.error("Failed to load saved state", e);
        }
    }
    return null;
}

// --- Content Renderer ---
function renderSidebar() {
    const sidebar = document.querySelector('.sidebar');

    // Header with Toggle Button for Mobile
    let html = `
        <div class="sidebar-header">
            <div class="sidebar-controls">
                <a href="/" class="sidebar-logo-link">
                    <img src="/images/logo_cropped.png" alt="Qubibyte Logo" class="sidebar-logo">
                </a>
                <button class="mobile-menu-toggle" onclick="toggleSidebar()">
                    <span>☰</span>
                </button>
            </div>
            <h4>Quantum Computing Tutorial</h4>
        </div>
        
        <div class="sidebar-menu" id="sidebar-menu">
    `;

    tutorialData.forEach((section, sIdx) => {
        html += `<div class="sidebar-group-title">${section.title}</div>`;
        section.subsections.forEach((sub, subIdx) => {
            const active = (sIdx === currentSection && subIdx === currentSubsection) ? 'active' : '';
            // Close menu on click (for mobile experience)
            html += `<a href="#" class="${active}" onclick="loadPage(${sIdx}, ${subIdx}); toggleSidebar(false); return false;">${sub.title}</a>`;
        });
    });

    html += `<a href="/" class="home-link">&larr; Back to Home</a>`;
    html += `</div>`; // End sidebar-menu

    sidebar.innerHTML = html;
}

function cleanupVisualizers() {
    activeVisualizers.forEach(viz => {
        if (viz && typeof viz.cleanup3D === 'function') {
            viz.cleanup3D();
        }
    });
    activeVisualizers = [];
}

function loadPage(sIdx, subIdx) {
    // Cleanup old visualizers before removing DOM elements
    cleanupVisualizers();

    currentSection = sIdx;
    currentSubsection = subIdx;

    // Save State silently
    saveState();

    // Update Sidebar Active State
    renderSidebar();

    const data = tutorialData[sIdx].subsections[subIdx];
    const contentDiv = document.getElementById('content-area');

    // 1. Render Main Content
    let html = `<h1>${data.title}</h1>`;
    html += data.content;

    // 2. Render Subsection Quiz (if exists and not the final exam)
    if (data.quiz && data.quiz.length > 0) {
        html += renderQuiz(data.quiz, sIdx, subIdx);
    }
    // Special case: If this is the "Final Exam" page, render the exam UI
    else if (data.id === 'final_exam') {
        html += renderFinalExam();
    }

    // 3. Render Pagination
    html += renderPagination(sIdx, subIdx);

    contentDiv.innerHTML = html;
    scrollToTop();

    // Re-render MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([contentDiv]).catch((err) => console.log('MathJax error:', err));
    }

    // Slight delay to ensure DOM is ready for Three.js
    setTimeout(renderVisualizations, 50);
}

function renderPagination(sIdx, subIdx) {
    let prevBtn = '';
    let nextBtn = '';

    // Calculate Prev
    if (subIdx > 0) {
        prevBtn = `<button class="btn-nav" onclick="loadPage(${sIdx}, ${subIdx - 1})">&laquo; Previous</button>`;
    } else if (sIdx > 0) {
        // Go to last subsection of previous section
        let prevSecIdx = sIdx - 1;
        let prevSubIdx = tutorialData[prevSecIdx].subsections.length - 1;
        prevBtn = `<button class="btn-nav" onclick="loadPage(${prevSecIdx}, ${prevSubIdx})">&laquo; Previous</button>`;
    } else {
        prevBtn = `<button class="btn-nav disabled">&laquo; Previous</button>`;
    }

    // Calculate Next
    if (subIdx < tutorialData[sIdx].subsections.length - 1) {
        nextBtn = `<button class="btn-nav" onclick="loadPage(${sIdx}, ${subIdx + 1})">Next &raquo;</button>`;
    } else if (sIdx < tutorialData.length - 1) {
        nextBtn = `<button class="btn-nav" onclick="loadPage(${sIdx + 1}, 0)">Next &raquo;</button>`;
    } else {
        nextBtn = `<button class="btn-nav disabled">Next &raquo;</button>`;
    }

    return `
        <div class="pagination">
            ${prevBtn}
            ${nextBtn}
        </div>
    `;
}

// --- Visualization Engine ---
function renderVisualizations() {
    // 1. Matrices
    document.querySelectorAll('.matrix-container').forEach(container => {
        const gateType = container.getAttribute('data-matrix');
        const qubits = parseInt(container.getAttribute('data-qubits') || "1");

        if (typeof GateInfo !== 'undefined' && gateType) {
            let matrixHtml = "Matrix loading...";
            try {
                let matrix;
                let label = gateType;

                // Get Matrix
                if (typeof getMatrixForQubits === 'function') {
                    matrix = getMatrixForQubits(gateType, qubits);
                } else {
                    matrix = GateInfo[gateType]?.matrix || "Unknown";
                }

                // Format
                if (typeof formatMatrix === 'function') {
                    matrixHtml = formatMatrix(matrix);
                } else {
                    matrixHtml = JSON.stringify(matrix);
                }

                // Friendly Label
                if (GateInfo[gateType]) label = GateInfo[gateType].name;

            } catch (e) {
                console.error("Error rendering matrix", e);
                matrixHtml = "Error loading matrix.";
            }

            // Enhanced Matrix HTML Layout
            container.innerHTML = `
                <div class="matrix-box">
                    <div class="matrix-label">${gateType} Gate</div>
                    <div class="matrix-wrapper">${matrixHtml}</div>
                </div>
            `;
        }
    });

    // 2. Bloch Spheres (using Simulator's QubitVisualizer)
    document.querySelectorAll('.vis-container').forEach(container => {
        const initState = container.getAttribute('data-bloch'); // e.g., "H" or "0" or "X"
        const gateSequence = container.getAttribute('data-gates'); // e.g., "H,Z"

        container.innerHTML = ''; // Clear

        if (typeof QuantumState !== 'undefined' && typeof QubitVisualizer !== 'undefined') {
            try {
                const visId = 'bloch-' + Math.random().toString(36).substr(2, 9);
                container.id = visId;

                // Instantiate Visualizer
                const qVisualizer = new QubitVisualizer(visId);
                activeVisualizers.push(qVisualizer); // Track for cleanup

                const qState = new QuantumState(1);

                // Initialize State
                if (initState) {
                    if (initState === '1') qState.applyGate('X', 0);
                    else if (initState === '+') qState.applyGate('H', 0);
                    else if (initState === '-') { qState.applyGate('X', 0); qState.applyGate('H', 0); }
                }

                // Apply Gates
                if (gateSequence) {
                    const gates = gateSequence.split(',');
                    gates.forEach(g => {
                        const gateName = g.trim().toUpperCase();
                        if (gateName) qState.applyGate(gateName, 0);
                    });
                }

                // Render
                qVisualizer.updateVisualization(qState);

                // Post-Render Cleanup: Hide Helper Tabs (Simulator UI artifact)
                const tabs = container.querySelector('.viz-tabs-scrollable-wrapper');
                if (tabs) tabs.style.display = 'none';

                // Ensure height is good
                const threeContainer = container.querySelector('.bloch-sphere-3d-container');
                if (threeContainer) {
                    threeContainer.style.height = '350px';
                }

            } catch (e) {
                console.error("Error rendering visualization:", e);
                container.innerHTML = "Error loading visualization.";
            }
        } else {
            container.innerHTML = "Simulator libraries not loaded.";
        }
    });
}

// --- Quiz Engine (Subsection Mini-Quizzes) ---
function renderQuiz(questions, sIdx, subIdx) {
    let html = `<div class="quiz-container">
        <div class="quiz-header">Test Your Knowledge</div>
    `;

    questions.forEach((q, qIdx) => {
        html += `<div class="quiz-question" id="quiz-q-${qIdx}">
            <p>${qIdx + 1}. ${q.question}</p>
            <div class="quiz-options">
        `;
        q.options.forEach((opt, oIdx) => {
            html += `
                <label class="quiz-option" id="q${qIdx}-opt${oIdx}">
                    <input type="radio" name="q${qIdx}" value="${oIdx}"> ${opt}
                </label>
            `;
        });
        html += `</div>
        <div class="quiz-feedback" id="feedback-q${qIdx}"></div>
        </div>`;
    });

    html += `<button class="btn-check-answer" onclick="checkQuiz(${sIdx}, ${subIdx})">Check Answers</button>
    </div>`;
    return html;
}

function checkQuiz(sIdx, subIdx) {
    const questions = tutorialData[sIdx].subsections[subIdx].quiz;

    questions.forEach((q, qIdx) => {
        const selected = document.querySelector(`input[name="q${qIdx}"]:checked`);
        const feedback = document.getElementById(`feedback-q${qIdx}`);
        const options = document.querySelectorAll(`input[name="q${qIdx}"]`);

        // Reset Styles
        options.forEach(opt => {
            opt.parentElement.classList.remove('correct', 'incorrect');
        });

        if (!selected) {
            feedback.innerHTML = "Please select an answer.";
            feedback.style.color = "#ffa500"; // Orange
            feedback.style.display = "block";
            return;
        }

        const answer = parseInt(selected.value);
        const correct = q.correct; // index

        if (answer === correct) {
            selected.parentElement.classList.add('correct');
            feedback.innerHTML = "Correct! " + (q.explanation || "");
            feedback.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
            feedback.style.color = "#66ff66";
        } else {
            selected.parentElement.classList.add('incorrect');
            feedback.innerHTML = "Incorrect. Try again.";
            feedback.style.backgroundColor = "rgba(220, 53, 69, 0.2)";
            feedback.style.color = "#ff6666";
        }
        feedback.style.display = "block";
    });
}

// --- Final Exam Engine ---
function renderFinalExam() {
    // Check if already passed
    const examState = getExamState();
    if (examState.passed) {
        return renderSuccessDashboard(examState);
    }

    // 1. Shuffle
    const shuffled = [...finalExamQuestions].sort(() => 0.5 - Math.random());
    // 2. Take top 30
    currentExamQuestions = shuffled.slice(0, 30);
    const questions = currentExamQuestions;

    let html = `<div class="quiz-container" id="exam-container">
        <div class="quiz-header">Final Certification Exam</div>
        <p>This exam consists of 30 randomly selected questions from a large pool. You need 80% (24/30) to pass.</p>
        <hr style="border-color: #555; margin-bottom: 20px;">
    `;

    questions.forEach((q, qIdx) => {
        html += `<div class="quiz-question" id="exam-q-${qIdx}">
            <p>${qIdx + 1}. ${q.question}</p>
            <div class="quiz-options">
        `;
        q.options.forEach((opt, oIdx) => {
            html += `
                <label class="quiz-option">
                    <input type="radio" name="exam-q${qIdx}" value="${oIdx}"> ${opt}
                </label>
            `;
        });
        html += `</div>
        <!-- Feedback Placeholder -->
        <div class="quiz-feedback" id="exam-feedback-${qIdx}" style="display:none; margin-top:10px; padding:10px; border-radius:5px;"></div>
        </div>`;
    });

    html += `<button class="btn-check-answer" onclick="submitExam()">Submit Exam</button>
    </div>`;

    return html;
}

function submitExam() {
    const questions = currentExamQuestions;
    let score = 0;
    let answeredAll = true;
    let feedbackData = [];

    questions.forEach((q, qIdx) => {
        const selected = document.querySelector(`input[name="exam-q${qIdx}"]:checked`);
        if (!selected) {
            answeredAll = false;
        } else {
            const answer = parseInt(selected.value);
            const isCorrect = answer === q.correct;
            if (isCorrect) score++;

            feedbackData.push({
                qIdx: qIdx,
                correct: isCorrect,
                userAnswer: answer,
                correctAnswer: q.correct
            });
        }
    });

    if (!answeredAll) {
        alert("Please answer all 30 questions before submitting.");
        return;
    }

    const percentage = (score / questions.length) * 100;
    const passed = percentage >= 80;

    // Save State
    saveExamState(passed, Math.round(percentage));

    // Render Results & Feedback
    showExamResultsWithFeedback(percentage, passed, feedbackData);
}

function showExamResultsWithFeedback(percentage, passed, feedbackData) {
    const container = document.getElementById('exam-container');
    const questions = currentExamQuestions;

    // Scroll to top of exam
    container.scrollIntoView({ behavior: 'smooth' });

    // 1. Show Feedback on each question
    feedbackData.forEach(item => {
        const feedbackDiv = document.getElementById(`exam-feedback-${item.qIdx}`);
        const inputs = document.getElementsByName(`exam-q${item.qIdx}`);
        const qData = questions[item.qIdx];

        // Disable inputs
        inputs.forEach(inp => inp.disabled = true);

        // Highlight
        if (item.correct) {
            feedbackDiv.innerHTML = "<strong>Correct!</strong>";
            feedbackDiv.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
            feedbackDiv.style.color = "#66ff66";
            feedbackDiv.style.display = 'block';
        } else {
            feedbackDiv.innerHTML = `<strong>Incorrect.</strong><br>Correct Answer: ${qData.options[item.correctAnswer]}`;
            feedbackDiv.style.backgroundColor = "rgba(220, 53, 69, 0.2)";
            feedbackDiv.style.color = "#ff6666";
            feedbackDiv.style.display = 'block';
        }
    });

    // 2. Clear the button area and show summary at the BOTTOM (or Top)
    // We append the result card at the top of the container
    const resultHTML = `
        <div class="exam-summary" style="background: rgba(0,0,0,0.3); border-radius: 10px; margin-bottom: 20px;">
            <h2>Exam Results</h2>
            <div class="score-display">${percentage.toFixed(0)}%</div>
            <p>${passed ? "Congratulations! You have passed the exam." : "You did not pass. You need 80% to receive a certificate."}</p>
            
            ${passed ? `
                <div style="margin-top: 30px; background: rgba(5, 75, 110, 0.3); padding: 20px; border-radius: 10px;">
                    <h3>Claim Your Certificate</h3>
                    <p>Enter your name as it should appear on the certificate:</p>
                    <input type="text" id="cert-name-input" placeholder="Your Name" style="padding: 10px; font-size: 1.2rem; width: 300px; border-radius: 5px; border: 1px solid #ccc; margin-bottom: 15px; color: black;">
                    <br>
                    <button class="btn-nav" onclick="generateCertificate()">Generate Certificate</button>
                    <br><br>
                    <button class="btn-nav" style="background: #555; font-size: 0.9rem;" onclick="retakeExam()">Retake Exam</button>
                </div>
            ` : `
                <button class="btn-nav" onclick="retakeExam()">Retake Exam</button>
            `}
        </div>
    `;

    // Insert results at the top
    container.insertAdjacentHTML('afterbegin', resultHTML);

    // Remove the old "Submit" button at the bottom
    const submitBtn = container.querySelector('.btn-check-answer');
    if (submitBtn) submitBtn.remove();
}

function renderSuccessDashboard(state) {
    return `
    <div class="quiz-container">
        <div class="quiz-header">Certification Status: <span style="color:#00ff00;">PASSED</span></div>
        <div class="exam-summary">
            <div class="score-display">${state.score}%</div>
            <p>You have already mastered this material.</p>
            
            <div style="margin-top: 30px; background: rgba(5, 75, 110, 0.3); padding: 20px; border-radius: 10px;">
                <h3>Certificate</h3>
                <p>Enter your name to regenerate your certificate:</p>
                <input type="text" id="cert-name-input" placeholder="Your Name" style="padding: 10px; font-size: 1.2rem; width: 300px; border-radius: 5px; border: 1px solid #ccc; margin-bottom: 15px; color: black;">
                <br>
                <button class="btn-nav" onclick="generateCertificate()">View Certificate</button>
                <br><br>
                <hr style="border-color: #555; margin: 20px 0;">
                <p style="font-size: 0.9rem; color: #ccc;">Want to try again? Retaking will clear your current score.</p>
                <button class="btn-nav" style="background: #d9534f; font-size: 0.9rem;" onclick="retakeExam()">Retake Exam</button>
            </div>
        </div>
    </div>
    `;
}

// --- Persistence Helpers ---
function saveExamState(passed, score) {
    localStorage.setItem('qubibyte_exam_data', JSON.stringify({ passed, score }));
}

function getExamState() {
    const data = localStorage.getItem('qubibyte_exam_data');
    if (data) return JSON.parse(data);
    return { passed: false, score: 0 };
}

function retakeExam() {
    if (confirm("Are you sure? This will clear your previous score.")) {
        localStorage.removeItem('qubibyte_exam_data');
        loadPage(currentSection, currentSubsection); // Reload current page
    }
}

function generateCertificate() {
    const name = document.getElementById('cert-name-input').value;
    if (!name) {
        alert("Please enter your name.");
        return;
    }

    // Format Date nicely
    const dateObj = new Date();
    const dateStr = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const refId = "QUBI-" + Math.floor(100000 + Math.random() * 900000); // Simple 6 digit ID

    const certHTML = `
        <div class="certificate-preview" id="cert-overlay">
            <button class="btn-close-cert" onclick="closeCertificate()">CLOSE X</button>
            <div class="certificate-inner">
                
                <div class="cert-header">
                    <div class="cert-title">Certificate of Completion</div>
                    <div class="cert-subtitle">Reference ID: ${refId}</div>
                </div>

                <div class="cert-body">
                    <p>This is to certify that</p>
                    <div class="cert-name">${name}</div>
                    <p>has successfully mastered the fundamental principles of</p>
                    <h2 class="cert-course-name">Quantum Computing Architecture</h2>
                    <p class="cert-desc">demonstrating proficiency in Superposition, Entanglement, and Quantum Algorithms.</p>
                </div>

                <div class="cert-footer">
                    <div class="cert-col">
                        <img src="/images/logo_cropped.png" alt="Qubibyte" class="cert-logo-img">
                    </div>
                    
                    <div class="cert-col">
                        <div class="cert-signature">Trent Rosenthal</div>
                        <div class="cert-role">Founder & CEO, Qubibyte</div>
                    </div>

                    <div class="cert-col">
                        <div class="cert-date">${dateStr}</div>
                        <div class="cert-role">Date Issued</div>
                    </div>
                </div>

            </div>
            
            <button class="btn-print" onclick="window.print()">🖨️ Print Certificate (Save as PDF)</button>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', certHTML);
    document.getElementById('cert-overlay').style.display = 'block';
}

function closeCertificate() {
    const overlay = document.getElementById('cert-overlay');
    if (overlay) overlay.remove();
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Check local storage for state
    const savedState = loadState();

    // Initial Render
    renderSidebar();

    if (savedState) {
        loadPage(savedState.s, savedState.sub);
    } else {
        // Default to Section 1 (Index 1) instead of Section 0 (Classical)
        // Check if Section 1 exists, else 0
        const defaultSec = tutorialData.length > 1 ? 1 : 0;
        loadPage(defaultSec, 0);
    }
});
