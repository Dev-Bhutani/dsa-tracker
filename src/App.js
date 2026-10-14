import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [progress, setProgress] = useState({});
  const [notes, setNotes] = useState({});
  const [starred, setStarred] = useState({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  const [url, setUrl] = useState('');

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Active notes toggle state
  const [activeNotesId, setActiveNotesId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    // Safety fallback for hanging loading screen on mobile networks
    const timer = setTimeout(() => setLoading(false), 5000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setQuestions(data.questions || []);
            setProgress(data.progress || {});
            setNotes(data.notes || {});
            setStarred(data.starred || {});
            setStreak(data.streak || 1);
          }
        } catch (err) {
          console.error("Firestore Load Error:", err);
        }
      } else {
        setQuestions([]);
        setProgress({});
        setNotes({});
        setStarred({});
        setStreak(0);
      }
      setLoading(false);
      clearTimeout(timer);
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const saveDataToCloud = async (newQ, newProg, newNotes, newStar, newStreak) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        questions: newQ,
        progress: newProg,
        notes: newNotes,
        starred: newStar,
        streak: newStreak
      }, { merge: true });
    } catch (error) {
      console.error("Cloud Save Error:", error);
    }
  };

  const handleGoogleLogin = async () => {
    try { 
      await signInWithPopup(auth, googleProvider); 
    } catch (e) { 
      console.error(e); 
      alert("Login Error: Please check Firebase Authorized Domains.");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddQuestion = (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");
    if (!title.trim() || !topic.trim()) return;

    const newQItem = {
      id: 'q-' + Date.now(),
      title: title.trim(),
      topic: topic.trim(),
      difficulty: difficulty,
      url: url.trim()
    };

    const updatedQuestions = [...questions, newQItem];
    setQuestions(updatedQuestions);
    saveDataToCloud(updatedQuestions, progress, notes, starred, streak);

    setTitle('');
    setTopic('');
    setUrl('');
  };

  const toggleQuestion = (id) => {
    const updated = { ...progress, [id]: !progress[id] };
    setProgress(updated);
    saveDataToCloud(questions, updated, notes, starred, streak);
  };

  const toggleStar = (id) => {
    const updated = { ...starred, [id]: !starred[id] };
    setStarred(updated);
    saveDataToCloud(questions, progress, notes, updated, streak);
  };

  const handleSaveNote = (id, noteText) => {
    const updated = { ...notes, [id]: noteText };
    setNotes(updated);
    saveDataToCloud(questions, progress, updated, starred, streak);
  };

  const deleteQuestion = (id) => {
    const updatedQ = questions.filter(q => q.id !== id);
    const updatedP = { ...progress }; delete updatedP[id];
    const updatedN = { ...notes }; delete updatedN[id];
    const updatedS = { ...starred }; delete updatedS[id];

    setQuestions(updatedQ);
    setProgress(updatedP);
    setNotes(updatedN);
    setStarred(updatedS);
    saveDataToCloud(updatedQ, updatedP, updatedN, updatedS, streak);
  };

  const pickRandomUnsolved = () => {
    const unsolved = questions.filter(q => !progress[q.id]);
    if (unsolved.length === 0) return alert("No unsolved questions available!");
    const random = unsolved[Math.floor(Math.random() * unsolved.length)];
    alert(`Challenge Problem: [${random.topic}] ${random.title} (${random.difficulty})`);
  };

  // Export Backup Function (Mobile-friendly data URI approach)
  const exportBackup = () => {
    if (!user) return alert("Please login first!");
    const backupData = { questions, progress, notes, starred, streak };
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `dsa-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Backup Function
  const importBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const newQ = data.questions || questions;
        const newProg = data.progress || progress;
        const newNotes = data.notes || notes;
        const newStar = data.starred || starred;
        const newStreak = data.streak || streak;

        setQuestions(newQ);
        setProgress(newProg);
        setNotes(newNotes);
        setStarred(newStar);
        setStreak(newStreak);

        await saveDataToCloud(newQ, newProg, newNotes, newStar, newStreak);
        alert("Backup successfully restored!");
      } catch (err) {
        alert("Invalid backup file!");
      }
      e.target.value = null; // Clear input for mobile retry
    };
    reader.readAsText(file);
  };

  // Filtered Questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || q.topic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiff = filterDifficulty === 'All' || q.difficulty === filterDifficulty;
    const isSolved = !!progress[q.id];
    const matchesStatus = filterStatus === 'All' ? true : filterStatus === 'Solved' ? isSolved : filterStatus === 'Unsolved' ? !isSolved : starred[q.id];
    return matchesSearch && matchesDiff && matchesStatus;
  });

  const groupedQuestions = filteredQuestions.reduce((acc, q) => {
    if (!acc[q.topic]) acc[q.topic] = [];
    acc[q.topic].push(q);
    return acc;
  }, {});

  const totalQuestions = questions.length;
  const completedCount = Object.values(progress).filter(Boolean).length;
  const percentage = totalQuestions > 0 ? Math.round((completedCount / totalQuestions) * 100) : 0;

  const theme = {
    bg: darkMode ? '#121212' : '#f4f6f9',
    cardBg: darkMode ? '#1e1e1e' : '#fff',
    text: darkMode ? '#f1f3f4' : '#333',
    subText: darkMode ? '#aaa' : '#6c757d',
    border: darkMode ? '#333' : '#e0e0e0',
    headerBg: darkMode ? '#1e1e1e' : '#fff',
    inputBg: darkMode ? '#2a2a2a' : '#fff',
    inputText: darkMode ? '#fff' : '#333',
    hoverBg: darkMode ? '#2a2a2a' : '#f8f9fa'
  };

  const getDiffColor = (diff) => {
    if (diff === 'Easy') return '#28a745';
    if (diff === 'Medium') return '#ffc107';
    return '#dc3545';
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px', fontSize: '18px', fontWeight: 'bold' }}>Loading DSA Tracker...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, padding: '15px', fontFamily: 'Segoe UI, sans-serif', color: theme.text, transition: 'all 0.3s ease' }}>
      <div style={{ maxWidth: '950px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: theme.headerBg, padding: '15px 20px', borderRadius: '12px', border: `1px solid ${theme.border}`, marginBottom: '20px', gap: '10px' }}>
          <h1 style={{ margin: 0, color: '#1a73e8', fontSize: '20px' }}>DSA Tracker</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ padding: '6px 12px', cursor: 'pointer', background: darkMode ? '#ffc107' : '#343a40', color: darkMode ? '#000' : '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>
              {darkMode ? 'Light' : 'Dark'}
            </button>
            {user ? (
              <>
                <span style={{ background: darkMode ? '#2a3b4c' : '#e8f0fe', padding: '5px 10px', borderRadius: '15px', fontWeight: '600', color: '#1a73e8', fontSize: '13px' }}>
                  Streak: {streak} d
                </span>
                {user.photoURL && <img src={user.photoURL} alt="profile" style={{ width: '32px', borderRadius: '50%' }} />}
                <button onClick={handleLogout} style={{ padding: '6px 12px', cursor: 'pointer', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px' }}>Logout</button>
              </>
            ) : (
              <button onClick={handleGoogleLogin} style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '6px' }}>Sign in with Google</button>
            )}
          </div>
        </div>

        {!user ? (
          <div style={{ textAlign: 'center', marginTop: '80px', background: theme.cardBg, padding: '30px', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
            <h2>Sign in with Google to start tracking!</h2>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div style={{ background: theme.cardBg, padding: '15px', borderRadius: '12px', border: `1px solid ${theme.border}`, textAlign: 'center' }}>
                <span style={{ color: theme.subText, fontSize: '12px' }}>Total Questions</span>
                <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold' }}>{totalQuestions}</p>
              </div>
              <div style={{ background: theme.cardBg, padding: '15px', borderRadius: '12px', border: `1px solid ${theme.border}`, textAlign: 'center' }}>
                <span style={{ color: theme.subText, fontSize: '12px' }}>Solved</span>
                <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>{completedCount}</p>
              </div>
              <div style={{ background: theme.cardBg, padding: '15px', borderRadius: '12px', border: `1px solid ${theme.border}`, textAlign: 'center' }}>
                <span style={{ color: theme.subText, fontSize: '12px' }}>Progress</span>
                <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#1a73e8' }}>{percentage}%</p>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div style={{ background: theme.cardBg, padding: '15px 20px', borderRadius: '12px', border: `1px solid ${theme.border}`, marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
                <span>Overall Progress</span>
                <span>{percentage}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: darkMode ? '#333' : '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #4285F4, #34A853)', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>

            {/* Add Question Form */}
            <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '12px', border: `1px solid ${theme.border}`, marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>Add New Question</h3>
              <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10px' }}>
                <input type="text" placeholder="Title (e.g. Two Sum)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.inputText, fontSize: '13px' }} required />
                <input type="text" placeholder="Topic / Category (e.g. Arrays)" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ flex: '1 1 140px', padding: '9px 12px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.inputText, fontSize: '13px' }} required />
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ flex: '0 1 100px', padding: '9px 10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.inputText, fontSize: '13px' }}>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                <input type="url" placeholder="LeetCode / GFG Link" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.inputText, fontSize: '13px' }} />
                <button type="submit" style={{ padding: '9px 18px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Add</button>
              </form>
            </div>

            {/* Controls Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: theme.cardBg, padding: '12px 15px', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
              <input type="text" placeholder="Search question or topic..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: '1 1 180px', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.inputText, fontSize: '13px' }} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)} style={{ padding: '7px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.inputText, fontSize: '12px' }}>
                  <option value="All">All Difficulty</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '7px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.inputText, fontSize: '12px' }}>
                  <option value="All">All Status</option>
                  <option value="Solved">Solved Only</option>
                  <option value="Unsolved">Unsolved Only</option>
                  <option value="Starred">Revision Only</option>
                </select>
                <button onClick={pickRandomUnsolved} style={{ padding: '7px 12px', background: '#6c5ce7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  Pick Random
                </button>
                <button onClick={exportBackup} style={{ padding: '7px 12px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  Export Backup
                </button>
                <label style={{ padding: '7px 12px', background: '#6c757d', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' }}>
                  Import Backup
                  <input type="file" accept=".json" onChange={importBackup} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* Questions List */}
            {Object.keys(groupedQuestions).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', background: theme.cardBg, borderRadius: '12px', color: theme.subText, border: `1px solid ${theme.border}` }}>
                No matching questions found!
              </div>
            ) : (
              Object.keys(groupedQuestions).map((groupTopic) => {
                const topicQs = groupedQuestions[groupTopic];
                const topicSolved = topicQs.filter(q => progress[q.id]).length;
                const topicPct = Math.round((topicSolved / topicQs.length) * 100);

                return (
                  <div key={groupTopic} style={{ marginBottom: '20px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ background: darkMode ? '#252525' : '#f8f9fa', padding: '12px 18px', borderBottom: `1px solid ${theme.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px' }}>{groupTopic}</h3>
                        <span style={{ fontSize: '12px', color: theme.subText, fontWeight: '600' }}>{topicSolved} / {topicQs.length} Solved ({topicPct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: darkMode ? '#444' : '#e0e0e0', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${topicPct}%`, height: '100%', background: '#1a73e8' }}></div>
                      </div>
                    </div>

                    <div style={{ padding: '5px 15px' }}>
                      {topicQs.map((q) => (
                        <div key={q.id} style={{ borderBottom: `1px solid ${theme.border}`, padding: '10px 0' }}>
                          <div 
                            onMouseEnter={() => setHoveredId(q.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '4px 6px', borderRadius: '6px', backgroundColor: hoveredId === q.id ? theme.hoverBg : 'transparent' }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: '1 1 200px', fontSize: '14px' }}>
                              <input type="checkbox" checked={!!progress[q.id]} onChange={() => toggleQuestion(q.id)} style={{ width: '16px', height: '16px', marginRight: '10px', accentColor: '#1a73e8' }} />
                              <span style={{ textDecoration: progress[q.id] ? 'line-through' : 'none', color: progress[q.id] ? theme.subText : theme.text, fontWeight: '500' }}>
                                {q.title}
                              </span>
                            </label>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 'bold', color: getDiffColor(q.difficulty), border: `1px solid ${getDiffColor(q.difficulty)}`, padding: '2px 6px', borderRadius: '4px' }}>
                                {q.difficulty}
                              </span>
                              <button onClick={() => toggleStar(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                                {starred[q.id] ? '⭐' : '☆'}
                              </button>
                              <button onClick={() => setActiveNotesId(activeNotesId === q.id ? null : q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
                                📝
                              </button>
                              {q.url && (
                                <a href={q.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#1a73e8', textDecoration: 'none', fontWeight: 'bold' }}>Link</a>
                              )}
                              <button onClick={() => deleteQuestion(q.id)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '13px' }}>🗑️</button>
                            </div>
                          </div>

                          {activeNotesId === q.id && (
                            <div style={{ marginTop: '8px', padding: '10px', background: darkMode ? '#2a2a2a' : '#f1f3f4', borderRadius: '6px' }}>
                              <textarea
                                placeholder="Approach / Time Complexity..."
                                value={notes[q.id] || ''}
                                onChange={(e) => handleSaveNote(q.id, e.target.value)}
                                style={{ width: '100%', height: '50px', background: theme.cardBg, color: theme.inputText, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '6px', fontSize: '12px', resize: 'vertical' }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            <footer style={{ marginTop: '40px', paddingTop: '15px', borderTop: `1px solid ${theme.border}`, textAlign: 'center', fontSize: '13px', color: theme.subText }}>
              Made by <span style={{ color: '#1a73e8', fontWeight: 'bold' }}>Dev Bhutani</span>
            </footer>
          </>
        )}

      </div>
    </div>
  );
}

export default App;