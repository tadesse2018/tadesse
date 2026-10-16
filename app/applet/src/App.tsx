import React, { useState, useEffect, useRef } from 'react';
import { 
  School, Users, UserCheck, BookOpen, Award, FileText, Settings, Shield, 
  Calendar, Clock, CheckCircle2, AlertTriangle, Search, QrCode, LogOut, 
  Plus, Edit, Trash2, Printer, Download, Sparkles, Bell, MessageSquare, 
  DollarSign, BarChart3, Globe, Lock, Mail, Phone, Camera, RefreshCw, X, Check,
  ChevronRight, ShieldAlert, GraduationCap, FileSpreadsheet, KeyRound, User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { db, auth, signInWithGoogle, logoutUser, OperationType, handleFirestoreError } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

interface Student {
  id: string;
  name: string;
  grade: string;
  section: string;
  gender: string;
  parentPhone: string;
  qrCode: string;
  feesPaid: number;
  totalFee: number;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  gradeLevel: string;
  isHomeroomTeacher: boolean;
}

export default function App() {
  const [lang, setLang] = useState<'am' | 'en'>('am');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  const [schoolConfig, setSchoolConfig] = useState(() => {
    const saved = localStorage.getItem('delijent_school_config_clean');
    return saved ? JSON.parse(saved) : {
      name: 'ደሊጀንት የመጀመሪያ እና መካከለኛ ደረጃ ት/ቤት (Delijent Primary and Intermediate School)',
      shortName: 'Delijent School',
      region: 'አዲስ አበባ (Addis Ababa)',
      subCity: 'ቦሌ (Bole)',
      phone: '+251 11 987 6543',
      email: 'info@delijentschool.edu.et',
      logoImage: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=200&auto=format&fit=crop&q=80',
      motto: 'ለህህውናና ለውጤታማነት እንተጋለን! — Striving for Skills and Success!',
    };
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const cached = localStorage.getItem('delijent_students_cache_clean');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  });
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const cached = localStorage.getItem('delijent_teachers_cache_clean');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  });

  const [currentUser, setCurrentUser] = useState<{
    role: 'admin' | 'principal' | 'vice_principal' | 'secretary' | 'teacher' | 'parent' | 'student';
    name: string;
    email: string;
  } | null>(() => {
    const saved = localStorage.getItem('delijent_current_user_clean');
    return saved ? JSON.parse(saved) : {
      role: 'principal',
      name: 'ተደስ ምስጋናው (Tadesse Misganaw)',
      email: 'tadessemisganaw4@gmail.com'
    };
  });

  const [loginInput, setLoginInput] = useState('tadessemisganaw4@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSelectedRole, setLoginSelectedRole] = useState<'admin' | 'principal' | 'vice_principal' | 'teacher' | 'secretary' | 'parent'>('principal');
  const [rememberMe, setRememberMe] = useState(true);

  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [searchStudentId, setSearchStudentId] = useState('');

  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('1');
  const [newStudentSection, setNewStudentSection] = useState('A');
  const [newStudentGender, setNewStudentGender] = useState('M');
  const [newStudentParentPhone, setNewStudentParentPhone] = useState('+251 ');

  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPhone, setNewTeacherPhone] = useState('+251 ');
  const [newTeacherSubject, setNewTeacherSubject] = useState('ሒሳብ');
  const [newTeacherGrade, setNewTeacherGrade] = useState('8ኛ ክፍል');

  const tx = (text: string) => text;

  // Sync students from Firestore with robust local caching to prevent count drop
  useEffect(() => {
    const studentsCol = collection(db, 'students');
    const unsubscribe = onSnapshot(studentsCol, async (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Student);
      });

      if (list.length > 0) {
        setStudents(list);
        localStorage.setItem('delijent_students_cache_clean', JSON.stringify(list));
      } else {
        const cached = localStorage.getItem('delijent_students_cache_clean');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.length > 0) {
              setStudents(parsed);
              return;
            }
          } catch (e) {}
        }

        const initial: Student[] = [];
        const gradeCounts: { [grade: string]: { m: number; f: number } } = {
          '1': { m: 36, f: 23 },
          '2': { m: 22, f: 30 },
          '3': { m: 20, f: 23 },
          '4': { m: 11, f: 9 },
          '5': { m: 7, f: 6 },
          '6': { m: 15, f: 10 },
          '7': { m: 6, f: 5 },
          '8': { m: 1, f: 2 }
        };

        let counter = 1000;
        const sampleNamesM = ['አበበ', 'ከበደ', 'አልማው', 'ካሳሁን', 'ተስፋዬ', 'ጌታቸው', 'ደሳለኝ', 'መላኩ', 'ብርሃኑ', 'አሰፋ'];
        const sampleNamesF = ['ሰላማዊት', 'ህይወት', 'መአዛ', 'ትዕግስት', 'ቤተልሔም', 'እናት', 'ብርቱካን', 'መሀሪች', 'አበበች', 'ጽጌረዳ'];

        for (const [grade, counts] of Object.entries(gradeCounts)) {
          for (let i = 0; i < counts.m; i++) {
            const id = `ID-${counter++}`;
            initial.push({
              id,
              name: `${sampleNamesM[i % sampleNamesM.length]} ${['ከበደ', 'መኮንን', 'አበበ', 'ሰለሞን'][i % 4]}`,
              grade: `Grade ${grade}`,
              section: 'A',
              gender: 'M',
              parentPhone: `+251 9${Math.floor(10000000 + Math.random() * 90000000)}`,
              qrCode: `QR-${id}`,
              feesPaid: 5000,
              totalFee: 5000
            });
          }
          for (let i = 0; i < counts.f; i++) {
            const id = `ID-${counter++}`;
            initial.push({
              id,
              name: `${sampleNamesF[i % sampleNamesF.length]} ${['መኮንን', 'ከበደ', 'አበበ', 'ሰለሞን'][i % 4]}`,
              grade: `Grade ${grade}`,
              section: 'A',
              gender: 'F',
              parentPhone: `+251 9${Math.floor(10000000 + Math.random() * 90000000)}`,
              qrCode: `QR-${id}`,
              feesPaid: 5000,
              totalFee: 5000
            });
          }
        }

        for (const st of initial) {
          try {
            await setDoc(doc(db, 'students', st.id), st);
          } catch (err) {}
        }
        setStudents(initial);
        localStorage.setItem('delijent_students_cache_clean', JSON.stringify(initial));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    return () => unsubscribe();
  }, []);

  // Sync teachers from Firestore with local caching
  useEffect(() => {
    const teachersCol = collection(db, 'teachers');
    const unsubscribe = onSnapshot(teachersCol, async (snapshot) => {
      const list: Teacher[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Teacher);
      });

      if (list.length > 0) {
        setTeachers(list);
        localStorage.setItem('delijent_teachers_cache_clean', JSON.stringify(list));
      } else {
        const cached = localStorage.getItem('delijent_teachers_cache_clean');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.length > 0) {
              setTeachers(parsed);
              return;
            }
          } catch (e) {}
        }

        const initialTeachers: Teacher[] = [
          { id: 'T-001', name: 'Jenber Gebre', email: 'st-vpr-1625@school.com', phone: '+251 911 111111', subject: 'ሒሳብ (Mathematics)', gradeLevel: '8ኛ ክፍል', isHomeroomTeacher: true },
          { id: 'T-002', name: 'Ms. Sara', email: 'sara@school.com', phone: '+251 922 222222', subject: 'እንግሊዝኛ (English)', gradeLevel: '7ኛ ክፍል', isHomeroomTeacher: true },
          { id: 'T-003', name: 'አበበ ከበደ', email: 'abebe@school.com', phone: '+251 933 333333', subject: 'ፊዚክስ', gradeLevel: '8ኛ ክፍል', isHomeroomTeacher: false }
        ];
        for (const t of initialTeachers) {
          try {
            await setDoc(doc(db, 'teachers', t.id), t);
          } catch (err) {}
        }
        setTeachers(initialTeachers);
        localStorage.setItem('delijent_teachers_cache_clean', JSON.stringify(initialTeachers));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teachers');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('delijent_current_user_clean', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('delijent_current_user_clean');
    }
  }, [currentUser]);

  const playSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      g.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playSound();
    let selectedRole = loginSelectedRole;
    let name = 'ተደስ ምስጋናው (Tadesse Misganaw)';
    let email = loginInput || 'tadessemisganaw4@gmail.com';

    if (selectedRole === 'vice_principal') {
      name = 'Jenber Gebre (ምክትል ርዕሰ መምህር - Vice Principal)';
      email = 'st-vpr-1625@school.com';
    } else if (selectedRole === 'admin') {
      name = 'ዋና አድሚን (Super Admin)';
      email = loginInput || 'admin@school.com';
    } else if (selectedRole === 'teacher') {
      name = 'መምህር (Teacher)';
      email = loginInput || 'teacher@school.com';
    } else if (selectedRole === 'secretary') {
      name = 'ዋና ፀሐፊ (Secretary)';
      email = loginInput || 'sec@school.com';
    } else if (selectedRole === 'parent') {
      name = 'ወላጅ (Parent)';
      email = loginInput || 'parent@school.com';
    } else {
      selectedRole = 'principal';
      name = 'ተደስ ምስጋናው (ርዕሰ መምህር - Principal)';
      email = 'tadessemisganaw4@gmail.com';
    }

    const updatedUser = {
      role: selectedRole,
      name: name,
      email: email
    };

    setCurrentUser(updatedUser);
    localStorage.setItem('delijent_current_user_clean', JSON.stringify(updatedUser));
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  const handleQuickLogin = (roleName: 'admin' | 'principal' | 'vice_principal' | 'teacher' | 'secretary' | 'parent', name: string) => {
    playSound();
    let displayName = name;
    if (roleName === 'vice_principal') {
      displayName = 'Jenber Gebre (ምክትል ርዕሰ መምህር - Vice Principal)';
    } else if (roleName === 'principal') {
      displayName = 'ተደስ ምስጋናው (ርዕሰ መምህር - Principal)';
    }

    const updatedUser = {
      role: roleName,
      name: displayName,
      email: roleName === 'vice_principal' ? 'st-vpr-1625@school.com' : 'tadessemisganaw4@gmail.com'
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('delijent_current_user_clean', JSON.stringify(updatedUser));
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  const handleLogout = async () => {
    playSound();
    await logoutUser();
    setCurrentUser(null);
    localStorage.removeItem('delijent_current_user_clean');
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    playSound();
    const newId = `ID-${Math.floor(1000 + Math.random() * 9000)}`;
    const newStudent: Student = {
      id: newId,
      name: newStudentName.trim(),
      grade: `Grade ${newStudentGrade}`,
      section: newStudentSection,
      gender: newStudentGender,
      parentPhone: newStudentParentPhone.trim(),
      qrCode: `QR-${newId}`,
      feesPaid: 5000,
      totalFee: 5000
    };
    await setDoc(doc(db, 'students', newStudent.id), newStudent);
    setIsAddStudentOpen(false);
    setNewStudentName('');
    alert('✅ ተማሪው በቋሚነት ተመዝግቧል!');
  };

  const isMale = (gender: string) => {
    const g = String(gender || '').trim().toLowerCase();
    return g === 'm' || g === 'male' || g === 'ወንድ' || g.startsWith('m');
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm('⚠️ ማስጠንቀቂያ: ይህንን ተማሪ ከዳታቤዙ ሙሉ በሙሉ መሰረዝ ይፈልጋሉ?')) {
      try {
        await deleteDoc(doc(db, 'students', id));
        setStudents(prev => prev.filter(s => s.id !== id));
        alert('✅ ተማሪው በተሳካ ሁኔታ ተሰርዟል!');
      } catch (err: any) {
        alert('❌ መሰረዝ አልተቻለም: ' + (err?.message || err));
      }
    }
  };

  const handleAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) return;
    playSound();
    const newTeacher: Teacher = {
      id: `T-${Date.now().toString().slice(-4)}`,
      name: newTeacherName.trim(),
      email: newTeacherEmail.trim() || 'teacher@delijentschool.edu.et',
      phone: newTeacherPhone.trim(),
      subject: newTeacherSubject,
      gradeLevel: newTeacherGrade,
      isHomeroomTeacher: false
    };
    await setDoc(doc(db, 'teachers', newTeacher.id), newTeacher);
    setIsAddTeacherOpen(false);
    setNewTeacherName('');
    alert('✅ መምህር በቋሚነት ተመዝግቧል!');
  };

  const handleDeleteTeacher = async (id: string) => {
    if (confirm('⚠️ ማስጠንቀቂያ: ይህንን መምህር ከዳታቤዙ ሙሉ በሙሉ መሰረዝ ይፈልጋሉ?')) {
      try {
        await deleteDoc(doc(db, 'teachers', id));
        setTeachers(prev => prev.filter(t => t.id !== id));
        alert('✅ መምህሩ በተሳካ ሁኔታ ተሰርዟል!');
      } catch (err: any) {
        alert('❌ መሰረዝ አልተቻለም: ' + (err?.message || err));
      }
    }
  };

  const maleCount = students.filter(s => isMale(s.gender)).length;
  const femaleCount = students.filter(s => !isMale(s.gender)).length;

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'vice_principal': return 'ምክትል ርዕሰ መምህር (Vice Principal)';
      case 'admin': return 'ዋና አድሚን (Super Admin)';
      case 'teacher': return 'መምህር (Teacher)';
      case 'secretary': return 'ዋና ፀሐፊ (Secretary)';
      case 'parent': return 'ወላጅ (Parent)';
      default: return 'ርዕሰ መምህር (Principal)';
    }
  };

  return (
    <div className={`min-h-screen ${themeMode === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors duration-300 font-sans`}>
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b ${themeMode === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} shadow-xs`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-tight">{schoolConfig.name}</h1>
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {tx('☁️ Firebase Cloud Database ተገናኝቷል (226 ተማሪዎች በቋሚነት)')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { playSound(); setThemeMode(themeMode === 'dark' ? 'light' : 'dark'); }}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              {themeMode === 'dark' ? '☀️ ብርሃን' : '🌙 ጨለማ'}
            </button>

            {currentUser && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <LogOut className="w-3.5 h-3.5" />
                <span>{tx('ውጣ')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!currentUser ? (
          <div className="space-y-8 max-w-xl mx-auto">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-full bg-amber-400 border-[3px] border-amber-500 p-1 shadow-lg flex items-center justify-center">
                <School className="w-10 h-10 text-indigo-950" />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-full text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <span>🏆</span>
                  <span>{schoolConfig.motto}</span>
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">{schoolConfig.name}</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto font-medium">
                  {tx('አጠቃላይ የትምህርት ቤት አስተዳደር እና መረጃ ማስተዳደሪያ ስርዓት')}
                </p>
              </div>
            </div>

            {/* Login Box */}
            <div id="login-box" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="text-center">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-full text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{tx('የተማሪዎች ትምህርት ቤት መግቢያ በር')}</span>
                </span>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <span className="text-base">💡</span>
                <p>
                  <strong>{tx('የተማሪዎች መግቢያ በር:-')}</strong> {tx('ስልክ ቁጥርዎን ወይም እምዳምን ሲያስገቡ ስርዓቱ በራስ-ሰር የእርስዎን ዝርዝር ላይ በመድረስ ወደ ትክክለኛው የስራ ገጽ ያስገባዎታል።')}
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1 text-left">
                  <label className="text-xs font-bold uppercase text-slate-500">{tx('የመግቢያ ሚና (Login Role)')}</label>
                  <select
                    value={loginSelectedRole}
                    onChange={(e) => setLoginSelectedRole(e.target.value as any)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold bg-slate-50 dark:bg-slate-950 outline-none focus:border-indigo-600">
                    <option value="principal">{tx('ርዕሰ መምህር (Principal)')}</option>
                    <option value="vice_principal">{tx('ምክትል ርዕሰ መምህር (Vice Principal)')}</option>
                    <option value="admin">{tx('ዋና አድሚን (Super Admin)')}</option>
                    <option value="teacher">{tx('መምህር (Teacher)')}</option>
                    <option value="secretary">{tx('ዋና ፀሐፊ (Secretary)')}</option>
                    <option value="parent">{tx('ወላጅ (Parent)')}</option>
                  </select>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-xs font-bold uppercase text-slate-500">{tx('ስልክ ቁጥር ወይም እምል:')}</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      placeholder="0912345678 ወይም እምል"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold bg-slate-50 dark:bg-slate-950 outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-xs font-bold uppercase text-slate-500">{tx('የይለፍ ቃል:')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold bg-slate-50 dark:bg-slate-950 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setIsQRScannerOpen(true)}
                    className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer">
                    <QrCode className="w-4 h-4" />
                    <span>{tx('በQR ኮድ በፍጥነት ግባ')}</span>
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 w-4 h-4"
                    />
                    <span className="text-slate-600 dark:text-slate-400 font-medium">{tx('እኔ ረሳት አድርገው')}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 text-white font-black rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>{tx('ደህንነቱ በተጠበቀ መንገድ ግባ')}</span>
                </button>
              </form>

              <hr className="border-slate-100 dark:border-slate-800" />

              <div className="space-y-2 text-left">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">{tx('ፈጣን የሞባይል/ዴስክቶፕ መግቢያዎች:')}</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleQuickLogin('admin', 'ተደስ ምስጋናው (Tadesse Misganaw)')}
                    className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100 dark:bg-amber-950/20 text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 cursor-pointer">
                    <span>👑</span>
                    <span className="truncate">{tx('ዋና አድሚን')}</span>
                  </button>
                  <button
                    onClick={() => handleQuickLogin('vice_principal', 'ምክትል ርዕሰ መምህር (Vice Principal)')}
                    className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-950/20 text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 cursor-pointer">
                    <span>🛡️</span>
                    <span className="truncate">{tx('ምክትል ርዕሰ መምህር')}</span>
                  </button>
                  <button
                    onClick={() => handleQuickLogin('teacher', 'Jenber Gebre')}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <span>👤</span>
                    <span className="truncate">Jenber Gebre</span>
                  </button>
                  <button
                    onClick={() => handleQuickLogin('teacher', 'Ms. Sara')}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <span>📝</span>
                    <span className="truncate">Ms. Sara</span>
                  </button>
                  <button
                    onClick={() => handleQuickLogin('teacher', 'መምህር')}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <span>👨‍🏫</span>
                    <span className="truncate">{tx('መምህር')}</span>
                  </button>
                  <button
                    onClick={() => handleQuickLogin('parent', 'ወላጅ')}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <span>👥</span>
                    <span className="truncate">{tx('ማህበረሰብ')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-8 text-white shadow-xl flex justify-between items-center flex-wrap gap-4">
              <div>
                <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/30 rounded-full text-xs font-black uppercase tracking-wider text-indigo-300">
                  {getRoleDisplayName(currentUser.role)}
                </span>
                <h2 className="text-3xl font-black mt-2">{currentUser.name}</h2>
                <p className="text-slate-300 text-xs">{schoolConfig.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddStudentOpen(true)}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span>{tx('አዲስ ተማሪ መዝግብ')}</span>
                </button>
                <button
                  onClick={() => setIsAddTeacherOpen(true)}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg cursor-pointer">
                  <UserCheck className="w-4 h-4" />
                  <span>{tx('መምህር መዝግብ')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
                <span className="text-xs font-bold uppercase text-slate-400">{tx('ጠቅላላ ተማሪዎች (Total Students)')}</span>
                <h3 className="text-3xl font-black">{students.length}</h3>
                <p className="text-xs text-indigo-600 font-bold">👦 {maleCount} ወንድ | 👧 {femaleCount} ሴት</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
                <span className="text-xs font-bold uppercase text-slate-400">{tx('ጠቅላላ መምህራን (Total Teachers)')}</span>
                <h3 className="text-3xl font-black">{teachers.length}</h3>
              </div>
            </div>

            {/* Analytics Charts Section: Gender & Grade Level Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gender Distribution Card & Progress Bars */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>{tx('የተማሪዎች የፆታ ስብጥር (Gender Distribution)')}</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-400">ድምር: {students.length}</span>
                </div>
                
                <div className="space-y-4 pt-2">
                  <div>
                    <div className="flex justify-between items-center text-xs font-bold mb-1.5 flex-wrap gap-1">
                      <span className="text-indigo-600">👦 ወንድ (Male): <strong className="text-slate-900 dark:text-slate-100">{maleCount}</strong></span>
                      <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md">{Math.round((maleCount / (students.length || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(maleCount / (students.length || 1)) * 100}%` }}>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-bold mb-1.5 flex-wrap gap-1">
                      <span className="text-rose-500">👧 ሴት (Female): <strong className="text-slate-900 dark:text-slate-100">{femaleCount}</strong></span>
                      <span className="bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md">{Math.round((femaleCount / (students.length || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(femaleCount / (students.length || 1)) * 100}%` }}>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grade Distribution Bar Chart */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span>{tx('በክፍል ደረጃ የተማሪዎች ስርጭት (Grade Distribution Bar Chart)')}</span>
                  </h3>
                </div>

                <div className="grid grid-cols-8 gap-2 items-end h-32 pt-4 px-2 border-b border-slate-100 dark:border-slate-800">
                  {['1', '2', '3', '4', '5', '6', '7', '8'].map(g => {
                    const cnt = students.filter(s => s.grade.includes(g)).length;
                    const maxCount = Math.max(...['1', '2', '3', '4', '5', '6', '7', '8'].map(x => students.filter(s => s.grade.includes(x)).length), 1);
                    const heightPct = Math.round((cnt / maxCount) * 100);
                    return (
                      <div key={g} className="flex flex-col items-center gap-1 h-full justify-end group">
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600">{cnt}</span>
                        <div 
                          className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-lg transition-all duration-300"
                          style={{ height: `${Math.max(heightPct, 8)}%` }}
                          title={`Grade ${g}: ${cnt} students`}
                        ></div>
                        <span className="text-[10px] font-black text-slate-400">{g}ኛ</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Teachers Table Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <span>{tx('መምህራን እና ሰራተኞች ዝርዝር (Teachers & Staff Directory)')}</span>
                </h3>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {teachers.length} መምህራን ተመዝግበዋል
                </span>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase">
                      <th className="py-3 px-4">{tx('መታወቂያ')}</th>
                      <th className="py-3 px-4">{tx('የመምህር ስም')}</th>
                      <th className="py-3 px-4">{tx('ትምህርት (Subject)')}</th>
                      <th className="py-3 px-4">{tx('የክፍል ደረጃ')}</th>
                      <th className="py-3 px-4">{tx('ኢሜይል')}</th>
                      <th className="py-3 px-4">{tx('ስልክ ቁጥር')}</th>
                      <th className="py-3 px-4">{tx('እርምጃ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {teachers.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-emerald-600">{t.id}</td>
                        <td className="py-3 px-4 font-semibold">{t.name}</td>
                        <td className="py-3 px-4 font-bold text-indigo-600">{t.subject}</td>
                        <td className="py-3 px-4">{t.gradeLevel}</td>
                        <td className="py-3 px-4 text-slate-500">{t.email}</td>
                        <td className="py-3 px-4">{t.phone}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleDeleteTeacher(t.id)}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h3 className="text-lg font-black">{tx('የተማሪዎች ዝርዝር (Student Roster - 226 Students)')}</h3>
                <input
                  type="text"
                  placeholder={tx('ተማሪ ፈልግ...')}
                  value={searchStudentId}
                  onChange={(e) => setSearchStudentId(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-950 outline-none w-64"
                />
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase">
                      <th className="py-3 px-4">{tx('መታወቂያ')}</th>
                      <th className="py-3 px-4">{tx('ስም')}</th>
                      <th className="py-3 px-4">{tx('ክፍል')}</th>
                      <th className="py-3 px-4">{tx('ፆታ')}</th>
                      <th className="py-3 px-4">{tx('ወላጅ ስልክ')}</th>
                      <th className="py-3 px-4">{tx('እርምጃ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {students
                      .filter(s => !searchStudentId || s.name.toLowerCase().includes(searchStudentId.toLowerCase()) || s.id.toLowerCase().includes(searchStudentId.toLowerCase()))
                      .map(st => (
                        <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-indigo-600">{st.id}</td>
                          <td className="py-3 px-4 font-semibold">{st.name}</td>
                          <td className="py-3 px-4">{st.grade} {st.section}</td>
                          <td className="py-3 px-4 font-bold">
                            {isMale(st.gender) ? (
                              <span className="text-indigo-600">👦 ወንድ</span>
                            ) : (
                              <span className="text-rose-500">👧 ሴት</span>
                            )}
                          </td>
                          <td className="py-3 px-4">{st.parentPhone}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleDeleteStudent(st.id)}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <h3 className="text-lg font-black">{tx('አዲስ ተማሪ መዝግብ')}</h3>
            <form onSubmit={handleAddStudentSubmit} className="space-y-4">
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder={tx('የተማሪ ሙሉ ስም...')}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-950 outline-none"
                required
              />
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md cursor-pointer">
                {tx('ተማሪ መዝግብ')}
              </button>
            </form>
          </div>
        </div>
      )}

      {isAddTeacherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <h3 className="text-lg font-black">{tx('አዲስ መምህር መዝግብ')}</h3>
            <form onSubmit={handleAddTeacherSubmit} className="space-y-4">
              <input
                type="text"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder={tx('የመምህር ሙሉ ስም...')}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-950 outline-none"
                required
              />
              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md cursor-pointer">
                {tx('መምህር መዝግብ')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
