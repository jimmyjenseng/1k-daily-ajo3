import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  LayoutDashboard, Users, PlusCircle, CheckCircle2, XCircle,
  AlertTriangle, Download, Lock, Unlock, Edit2, Trash2, X,
  TrendingUp, Calendar, Coins, Trophy, ArrowRightLeft, RefreshCw,
  WifiOff, Star, Zap, Gift, ShieldCheck, ClipboardCheck, Flame,
} from 'lucide-react';
import { db } from './firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';

// --- Constants ---------------------------------------------------------------
const START_DATE    = new Date('2026-05-02T00:00:00');
const DAILY_AMOUNT  = 1000;
const FINE_AMOUNT   = 500;

// Passwords are stored as reversed+encoded strings to avoid plain text in source.
// Default group pw: "2026", admin pw: "3914"
// To decode: atob(s).split('').reverse().join('')
const ENC_GROUP_DEFAULT = btoa('2026'.split('').reverse().join(''));
const ENC_ADMIN_DEFAULT = btoa('3914'.split('').reverse().join(''));

async function sha256(str) {
  // Returns encoded form of the password for comparison
  return btoa(str.trim().split('').reverse().join(''));
}

const HANDS = [
  { no: 1,  name: 'Mummy David 1'  }, { no: 2,  name: 'ID 1'          }, { no: 3,  name: 'Sis Esther 1'  },
  { no: 4,  name: 'Mr Akeem'       }, { no: 5,  name: 'Sis Esther 2'  }, { no: 6,  name: 'Mrs Dosu'      },
  { no: 7,  name: 'T&K 1'          }, { no: 8,  name: 'Mummy Ola 1'   }, { no: 9,  name: 'Bidex 1'       },
  { no: 10, name: 'Sis Esther 3'  }, { no: 11, name: 'T&K 2'          }, { no: 12, name: 'Mummy Aishat'  },
  { no: 13, name: 'ID 2'           }, { no: 14, name: 'Bidex 2'        }, { no: 15, name: 'Mummy David 2' },
  { no: 16, name: 'Mr Habeeb'      }, { no: 17, name: 'Mrs Abiola 1'  }, { no: 18, name: 'Sis Tomi 1'    },
  { no: 19, name: 'Mrs Abiola 2'  }, { no: 20, name: 'Esther 1'       }, { no: 21, name: 'Mummy Ola 2'   },
  { no: 22, name: 'Sis Tomi 2'    }, { no: 23, name: 'Sis Tomi 3'    }, { no: 24, name: 'ID 3'           },
  { no: 25, name: 'Esther 2'       }, { no: 26, name: 'Mummy Awal'    }, { no: 27, name: 'Sis Tomi 4'    },
  { no: 28, name: 'Mathew'         }, { no: 29, name: 'Mrs Abiola 3'  }, { no: 30, name: 'T&K 3'         },
];
const DEFAULT_ORDER = HANDS.map(h => h.no);

// --- Helpers -----------------------------------------------------------------
const fmt          = n  => '\u20a6' + Number(n).toLocaleString('en-NG');
const todayKey     = () => new Date().toISOString().slice(0, 10);
const isAfter9pm   = () => new Date().getHours() >= 21;
const getDaysElapsed = () => Math.max(0, Math.floor((Date.now() - START_DATE.getTime()) / 86_400_000));

// --- Firebase helpers ---------------------------------------------------------
const settingsRef    = key => doc(db, 'settings', key);
const fbGetSetting   = async key => { const s = await getDoc(settingsRef(key)); return s.exists() ? s.data().value : null; };
const fbSetSetting   = async (key, value) => setDoc(settingsRef(key), { value });

// --- UI Atoms -----------------------------------------------------------------
function Pill({ children, variant = 'default' }) {
  const cls = {
    default: 'bg-[#2a2a2a] text-[#a3a3a3]',
    green:   'bg-green-500/10 text-green-400 border border-green-500/20',
    red:     'bg-red-500/10 text-red-400 border border-red-500/20',
    yellow:  'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    blue:    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  }[variant] || 'bg-[#2a2a2a] text-[#a3a3a3]';
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${cls}`}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="card p-5 flex flex-col gap-2 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="text-[#6b7280] text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? 'bg-[#22c55e]/10' : 'bg-[#2a2a2a]'}`}>
          <Icon size={15} className={accent ? 'text-[#22c55e]' : 'text-[#6b7280]'} />
        </div>
      </div>
      <div className="font-display text-2xl text-white">{value}</div>
      {sub && <div className="text-xs text-[#6b7280]">{sub}</div>}
    </div>
  );
}

function ProgressBar({ pct, color = '#22c55e' }) {
  return (
    <div className="w-full bg-[#2a2a2a] rounded-full h-2 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] border border-[#2a2a2a] rounded-3xl w-full max-w-md max-h-[90dvh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <h3 className="font-display text-lg text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#2a2a2a] transition-colors">
            <X size={16} className="text-[#6b7280]" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-[#2a2a2a] border-t-[#22c55e] animate-spin" />
      <p className="text-[#6b7280] text-sm">Loading AjoHub...</p>
    </div>
  );
}

// --- Group Password Gate (members) --------------------------------------------
function GroupGate({ onUnlock, groupHashStored }) {
  const [pw, setPw]   = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const attempt = async () => {
    setBusy(true);
    const h = await sha256(pw.trim());
    const expected = groupHashStored || ENC_GROUP_DEFAULT;
    if (h === expected) { onUnlock(); }
    else { setErr(true); setPw(''); }
    setBusy(false);
  };

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex flex-col items-center justify-center px-6 gap-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-[#141414] border border-[#2a2a2a] flex items-center justify-center">
          <span className="text-4xl">💰</span>
        </div>
        <h1 className="font-display text-3xl text-white">AjoHub</h1>
        <p className="text-[#6b7280] text-sm text-center">Enter your group password to continue</p>
      </div>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <input
          type="password"
          className={`input text-center text-lg tracking-widest ${err ? 'border-red-500' : ''}`}
          placeholder="****"
          value={pw}
          autoFocus
          onChange={e => { setPw(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
        />
        {err && <p className="text-red-400 text-xs text-center">Wrong password. Try again.</p>}
        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={attempt} disabled={busy}>
          {busy ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Enter AjoHub
        </button>
      </div>
    </div>
  );
}

// --- Admin Password Gate ------------------------------------------------------
function AdminGate({ onUnlock, onClose, adminHashStored }) {
  const [pw, setPw]     = useState('');
  const [err, setErr]   = useState(false);
  const [busy, setBusy] = useState(false);

  const attempt = async () => {
    setBusy(true);
    const h        = await sha256(pw.trim());
    const expected = adminHashStored || ENC_ADMIN_DEFAULT;
    if (h === expected) { onUnlock(); }
    else { setErr(true); setPw(''); }
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} title="Admin Access">
      <div className="flex flex-col gap-4">
        <p className="text-[#6b7280] text-sm">Enter admin password to unlock full controls.</p>
        <input
          type="password"
          className={`input ${err ? 'border-red-500' : ''}`}
          placeholder="Admin password"
          value={pw}
          autoFocus
          onChange={e => { setPw(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
        />
        {err && <p className="text-red-400 text-xs">Incorrect admin password</p>}
        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={attempt} disabled={busy}>
          {busy ? <RefreshCw size={13} className="animate-spin" /> : null}
          Unlock Admin
        </button>
      </div>
    </Modal>
  );
}

// --- Dashboard Tab ------------------------------------------------------------
function Dashboard({ payments, order, fines, defaults, checkins }) {
  const daysElapsed      = getDaysElapsed();
  const totalDays        = HANDS.length;
  const todayCollectorNo = order[daysElapsed] ?? null;
  const todayCollector   = HANDS.find(h => h.no === todayCollectorNo);
  const totalCollected   = payments.reduce((s, p) => s + p.amount, 0);
  const totalFines       = Object.values(fines).reduce((s, v) => s + v, 0);
  const defaultCount     = Object.keys(defaults).length;
  const pct              = (daysElapsed / totalDays) * 100;
  const todayPmts        = payments.filter(p => p.date === todayKey());
  const todayTotal       = todayPmts.reduce((s, p) => s + p.amount, 0);
  const recentPmts       = [...payments]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 6);

  // Savings score: % of days paid across all hands
  const totalExpected  = daysElapsed * HANDS.length * DAILY_AMOUNT;
  const savingsScore   = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // Streak: consecutive days with >=1 payment
  const dateSet = new Set(payments.map(p => p.date));
  let streak = 0;
  for (let i = 0; i < daysElapsed; i++) {
    const d = new Date(START_DATE);
    d.setDate(d.getDate() + (daysElapsed - 1 - i));
    if (dateSet.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }

  // Today's check-ins
  const todayCheckins = (checkins[todayKey()] || []).length;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Streak / Score banner */}
      <div className="card2 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Flame size={18} className="text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-[#6b7280] uppercase tracking-wider">Group Streak</p>
            <p className="font-display text-xl text-white">{streak} day{streak !== 1 ? 's' : ''} 🔥</p>
          </div>
        </div>
        <div className="h-10 w-px bg-[#2a2a2a]" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
            <Zap size={18} className="text-[#22c55e]" />
          </div>
          <div>
            <p className="text-xs text-[#6b7280] uppercase tracking-wider">Savings Score</p>
            <p className="font-display text-xl text-white">{savingsScore}%</p>
          </div>
        </div>
      </div>

      {/* Today's collector */}
      {todayCollector && (
        <div className="card p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#22c55e]/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs text-[#6b7280] uppercase tracking-widest font-medium">Today's Collector</span>
                <h2 className="font-display text-3xl text-white mt-1">{todayCollector.name}</h2>
                <p className="text-[#6b7280] text-sm mt-1">Hand #{todayCollector.no} - Day {daysElapsed + 1}</p>
              </div>
              <span className="text-4xl select-none">🎉</span>
            </div>
            <ProgressBar pct={pct} />
            <div className="flex justify-between mt-1.5 text-xs text-[#6b7280]">
              <span>Day {daysElapsed} of {totalDays}</span>
              <span>{Math.round(pct)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Coins}         label="Total Collected" value={fmt(totalCollected)} sub="All time"                accent />
        <StatCard icon={Calendar}      label="Days Elapsed"    value={daysElapsed}         sub={`of ${totalDays} days`}  />
        <StatCard icon={TrendingUp}    label="Today's Total"   value={fmt(todayTotal)}     sub={`${todayPmts.length} payment(s)`} />
        <StatCard icon={AlertTriangle} label="Total Fines"     value={fmt(totalFines)}     sub={`${defaultCount} defaulter(s)`} />
      </div>

      {/* Check-ins today */}
      {todayCheckins > 0 && (
        <div className="card2 p-4 flex items-center gap-3">
          <ClipboardCheck size={18} className="text-blue-400 shrink-0" />
          <div>
            <p className="text-sm text-white font-medium">{todayCheckins} member{todayCheckins !== 1 ? 's' : ''} checked in today</p>
            <p className="text-xs text-[#6b7280]">Pending admin confirmation</p>
          </div>
        </div>
      )}

      {/* Expected payout */}
      {todayCollector && (() => {
        const handFines     = fines[todayCollectorNo] || 0;
        const expectedPayout = HANDS.length * DAILY_AMOUNT - handFines;
        return (
          <div className="card2 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#6b7280] uppercase tracking-wider mb-1">Expected Payout Today</p>
              <p className="font-display text-xl text-white">{fmt(expectedPayout)}</p>
              {handFines > 0 && <p className="text-xs text-red-400 mt-0.5">-{fmt(handFines)} fines deducted</p>}
            </div>
            <Trophy size={28} className="text-[#22c55e] opacity-60" />
          </div>
        );
      })()}

      {/* Recent activity */}
      {recentPmts.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider mb-4">Recent Activity</h3>
          <div className="flex flex-col gap-2">
            {recentPmts.map((p, i) => {
              const hand = HANDS.find(h => h.no === p.handNo);
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e1e1e] last:border-0">
                  <div>
                    <p className="text-sm text-white font-medium">{hand?.name || `Hand #${p.handNo}`}</p>
                    <p className="text-xs text-[#6b7280]">{p.date} - {p.note || 'Payment'}</p>
                  </div>
                  <span className="font-mono text-[#22c55e] text-sm font-medium">+{fmt(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Hands Tab ----------------------------------------------------------------
function HandsTab({ payments, order, setOrderRemote, fines, defaults, isAdmin }) {
  const [swapMode, setSwapMode] = useState(false);
  const [swapA,    setSwapA]    = useState(null);
  const daysElapsed = getDaysElapsed();
  const after9      = isAfter9pm();

  useEffect(() => { if (!isAdmin) { setSwapMode(false); setSwapA(null); } }, [isAdmin]);

  const getPaidDays = no => payments.filter(p => p.handNo === no).length;
  const paidToday   = no => payments.some(p => p.handNo === no && p.date === todayKey());
  const isDefaulted = no => after9 && !paidToday(no);

  const handleSwapSelect = async (handNo) => {
    if (!swapA) {
      setSwapA(handNo);
      toast('Tap the second hand to swap with', { icon: '🔄' });
    } else if (swapA === handNo) {
      setSwapA(null);
    } else {
      const newOrder = [...order];
      const iA = newOrder.indexOf(swapA);
      const iB = newOrder.indexOf(handNo);
      if (iA !== -1 && iB !== -1) {
        [newOrder[iA], newOrder[iB]] = [newOrder[iB], newOrder[iA]];
        await setOrderRemote(newOrder);
        toast.success(`Swapped positions ${iA + 1} & ${iB + 1}`);
      }
      setSwapA(null); setSwapMode(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-white">
          All Hands <span className="text-[#6b7280] font-sans text-base font-normal">({HANDS.length})</span>
        </h2>
        {isAdmin && (
          <button
            onClick={() => { setSwapMode(s => !s); setSwapA(null); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${swapMode ? 'bg-[#22c55e] text-black' : 'btn-ghost'}`}
          >
            <ArrowRightLeft size={13} />
            {swapMode ? 'Cancel' : 'Swap Order'}
          </button>
        )}
      </div>

      {swapMode && (
        <div className="card2 p-3 text-xs text-[#6b7280] flex items-center gap-2">
          <ArrowRightLeft size={13} className="text-[#22c55e] shrink-0" />
          {swapA ? `Selected Hand #${swapA}. Tap another to swap.` : 'Tap any two hands to swap their payout positions.'}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {order.map((handNo, posIdx) => {
          const hand      = HANDS.find(h => h.no === handNo);
          if (!hand) return null;
          const paidDays  = getPaidDays(handNo);
          const paid      = paidToday(handNo);
          const defaulted = isDefaulted(handNo);
          const handFines = fines[handNo] || 0;
          const defCnt    = defaults[handNo] || 0;
          const isToday   = posIdx === daysElapsed;
          const isPast    = posIdx < daysElapsed;
          const isSel     = swapA === handNo;
          const payDate   = new Date(START_DATE);
          payDate.setDate(payDate.getDate() + posIdx);
          const dateStr = payDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

          return (
            <div
              key={handNo}
              onClick={swapMode ? () => handleSwapSelect(handNo) : undefined}
              className={[
                'card2 p-4 transition-all duration-200',
                swapMode ? 'cursor-pointer hover:border-[#22c55e]/50' : '',
                isSel    ? 'border-[#22c55e] ring-1 ring-[#22c55e]'  : '',
                isToday  ? 'border-[#22c55e]/40 bg-[#22c55e]/5'      : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <div className={[
                  'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-medium shrink-0',
                  isToday ? 'bg-[#22c55e] text-black' : isPast ? 'bg-[#2a2a2a] text-[#6b7280]' : 'bg-[#2a2a2a] text-[#a3a3a3]',
                ].join(' ')}>
                  {posIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm truncate">{hand.name}</span>
                    {isToday  && <Pill variant="green">Today 🎉</Pill>}
                    {defCnt >= 2 && <Pill variant="red">2x default</Pill>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-[#6b7280]">#{hand.no} - {dateStr}</span>
                    <span className="text-xs text-[#6b7280]">{paidDays}d paid</span>
                    {handFines > 0 && <span className="text-xs text-red-400">Fine: {fmt(handFines)}</span>}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  {paid ? (
                    <CheckCircle2 size={18} className="text-[#22c55e]" />
                  ) : defaulted ? (
                    <>
                      <XCircle size={18} className="text-red-400" />
                      <span className="text-[10px] text-red-400 font-medium">+{fmt(FINE_AMOUNT)}</span>
                    </>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#3a3a3a]" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Check-in Tab -------------------------------------------------------------
function CheckinTab({ payments, checkins, setCheckinsRemote, order }) {
  const [selectedNo, setSelectedNo] = useState('');
  const [saving, setSaving]         = useState(false);

  const today       = todayKey();
  const todayChecks = checkins[today] || [];
  const alreadyPaid = no => payments.some(p => p.handNo === Number(no) && p.date === today);
  const alreadyIn   = no => todayChecks.includes(Number(no));

  const doCheckin = async () => {
    if (!selectedNo) return toast.error('Select your hand first');
    const no = Number(selectedNo);
    if (alreadyPaid(no)) return toast('Admin has already logged your payment ✅', { icon: '✅' });
    if (alreadyIn(no))   return toast('Already checked in today!', { icon: '✅' });
    setSaving(true);
    try {
      const updated = { ...checkins, [today]: [...todayChecks, no] };
      await setCheckinsRemote(updated);
      toast.success('Checked in! Admin will confirm your payment.');
      setSelectedNo('');
    } catch (e) { toast.error('Check-in failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ClipboardCheck size={18} className="text-blue-400" />
            </div>
            <div>
              <h2 className="font-display text-xl text-white">Daily Check-in</h2>
              <p className="text-xs text-[#6b7280]">Tap to let the group know you paid</p>
            </div>
          </div>
          <select
            className="input"
            value={selectedNo}
            onChange={e => setSelectedNo(e.target.value)}
          >
            <option value="">Select your hand...</option>
            {order.map(no => {
              const h = HANDS.find(x => x.no === no);
              return h ? <option key={no} value={no}>#{no} -- {h.name}</option> : null;
            })}
          </select>
          <button
            className="btn-primary w-full flex items-center justify-center gap-2"
            onClick={doCheckin}
            disabled={saving}
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
            I Paid Today ✅
          </button>
        </div>
      </div>

      <div className="card p-5 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider">
          Today's Check-ins ({todayChecks.length})
        </h3>
        {todayChecks.length === 0 ? (
          <p className="text-[#6b7280] text-sm text-center py-4">No check-ins yet today</p>
        ) : (
          <div className="flex flex-col gap-2">
            {todayChecks.map(no => {
              const hand    = HANDS.find(h => h.no === no);
              const confirmed = alreadyPaid(no);
              return (
                <div key={no} className="card2 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{hand?.name || `Hand #${no}`}</p>
                    <p className="text-xs text-[#6b7280]">Self-reported</p>
                  </div>
                  {confirmed
                    ? <Pill variant="green"><CheckCircle2 size={10} /> Confirmed</Pill>
                    : <Pill variant="yellow">Pending</Pill>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Leaderboard Tab ---------------------------------------------------------
function LeaderboardTab({ payments, fines }) {
  const daysElapsed = getDaysElapsed();

  const scores = useMemo(() => HANDS.map(hand => {
    const paidDays    = payments.filter(p => p.handNo === hand.no).length;
    const handFines   = fines[hand.no] || 0;
    const consistency = daysElapsed > 0 ? Math.round((paidDays / daysElapsed) * 100) : 0;
    const score       = paidDays * 10 - (handFines / 100);
    return { ...hand, paidDays, handFines, consistency, score };
  }).sort((a, b) => b.score - a.score), [payments, fines, daysElapsed]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Trophy size={20} className="text-[#22c55e]" />
        <h2 className="font-display text-xl text-white">Leaderboard</h2>
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-2">
        {scores.slice(0, 3).map((h, i) => (
          <div key={h.no} className={`card2 p-3 flex flex-col items-center gap-1 text-center ${i === 0 ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}>
            <span className="text-2xl">{medals[i]}</span>
            <p className="text-white text-xs font-semibold leading-tight">{h.name}</p>
            <p className="text-[#22c55e] font-mono text-xs font-medium">{h.paidDays}d</p>
            <p className="text-[10px] text-[#6b7280]">{h.consistency}%</p>
          </div>
        ))}
      </div>

      {/* Full list */}
      <div className="card p-5 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">All Rankings</h3>
        {scores.map((h, i) => (
          <div key={h.no} className="flex items-center gap-3 py-2 border-b border-[#1e1e1e] last:border-0">
            <span className={`font-mono text-xs w-6 text-center ${i < 3 ? 'text-[#22c55e]' : 'text-[#4a4a4a]'}`}>
              {i < 3 ? medals[i] : `${i + 1}`}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{h.name}</p>
              <div className="mt-1">
                <ProgressBar pct={h.consistency} color={h.handFines > 0 ? '#f87171' : '#22c55e'} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-white font-mono">{h.paidDays}d</p>
              <p className="text-[10px] text-[#6b7280]">{h.consistency}%</p>
              {h.handFines > 0 && <p className="text-[10px] text-red-400">{fmt(h.handFines)}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Rewards Tab -------------------------------------------------------------
function RewardsTab({ payments, fines, isAdmin, rewardsLog, setRewardsLogRemote }) {
  const [showDisburse, setShowDisburse] = useState(false);
  const [disburseNo,   setDisburseNo]   = useState('');
  const [disburseAmt,  setDisburseAmt]  = useState('');
  const [saving,       setSaving]       = useState(false);

  const totalFines  = Object.values(fines).reduce((s, v) => s + v, 0);
  const totalPaid   = rewardsLog.reduce((s, r) => s + r.amount, 0);
  const pool        = totalFines - totalPaid;

  // Weekly top saver: highest paid days in last 7 days
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekKey    = oneWeekAgo.toISOString().slice(0, 10);
  const weekPmts   = payments.filter(p => p.date >= weekKey);
  const weekCounts = HANDS.map(h => ({ hand: h, count: weekPmts.filter(p => p.handNo === h.no).length }))
    .sort((a, b) => b.count - a.count);
  const topSaver   = weekCounts[0];

  const disburse = async () => {
    if (!disburseNo || !disburseAmt) return toast.error('Fill all fields');
    const amt  = Number(disburseAmt);
    if (amt <= 0 || amt > pool)     return toast.error('Invalid amount');
    setSaving(true);
    try {
      const hand    = HANDS.find(h => h.no === Number(disburseNo));
      const updated = [...rewardsLog, { handNo: Number(disburseNo), name: hand?.name, amount: amt, date: todayKey() }];
      await setRewardsLogRemote(updated);
      toast.success(`${fmt(amt)} disbursed to ${hand?.name}`);
      setShowDisburse(false); setDisburseNo(''); setDisburseAmt('');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Pool card */}
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <Gift size={18} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280] uppercase tracking-wider">Rewards Pool</p>
              <p className="font-display text-3xl text-white">{fmt(pool)}</p>
            </div>
          </div>
          <p className="text-xs text-[#6b7280]">{fmt(totalFines)} collected in fines - {fmt(totalPaid)} disbursed</p>
          {isAdmin && pool > 0 && (
            <button
              className="btn-primary flex items-center justify-center gap-2 mt-1"
              onClick={() => setShowDisburse(true)}
            >
              <Gift size={14} /> Disburse Reward
            </button>
          )}
        </div>
      </div>

      {/* Weekly top saver */}
      {topSaver && topSaver.count > 0 && (
        <div className="card2 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-2xl">
            (*)
          </div>
          <div>
            <p className="text-xs text-[#6b7280] uppercase tracking-wider mb-1">Weekly Top Saver</p>
            <p className="text-white font-semibold">{topSaver.hand.name}</p>
            <p className="text-xs text-[#22c55e]">{topSaver.count} payments this week</p>
          </div>
        </div>
      )}

      {/* Disbursement history */}
      {rewardsLog.length > 0 && (
        <div className="card p-5 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider">Disbursement History</h3>
          {[...rewardsLog].reverse().map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e1e1e] last:border-0">
              <div>
                <p className="text-sm text-white font-medium">{r.name || `Hand #${r.handNo}`}</p>
                <p className="text-xs text-[#6b7280]">{r.date}</p>
              </div>
              <span className="text-yellow-400 font-mono text-sm">{fmt(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <Modal open={showDisburse} onClose={() => setShowDisburse(false)} title="Disburse Reward">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[#6b7280]">Available pool: <span className="text-[#22c55e]">{fmt(pool)}</span></p>
          <select className="input" value={disburseNo} onChange={e => setDisburseNo(e.target.value)}>
            <option value="">Select recipient...</option>
            {HANDS.map(h => <option key={h.no} value={h.no}>#{h.no} -- {h.name}</option>)}
          </select>
          <input type="number" className="input" placeholder="Amount (NGN)" value={disburseAmt} onChange={e => setDisburseAmt(e.target.value)} />
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={disburse} disabled={saving}>
            {saving && <RefreshCw size={13} className="animate-spin" />}
            Confirm Disburse
          </button>
        </div>
      </Modal>
    </div>
  );
}

// --- Admin / Log Tab ----------------------------------------------------------
function AdminTab({
  payments, fines, setFinesRemote, defaults, setDefaultsRemote,
  order, setOrderRemote, isAdmin, setIsAdmin,
  adminHashStored, setAdminHashRemote,
  groupHashStored, setGroupHashRemote,
  checkins, setCheckinsRemote,
}) {
  const [showGate,      setShowGate]      = useState(false);
  const [form,          setForm]          = useState({ handNo: '', amount: DAILY_AMOUNT, note: '', date: todayKey() });
  const [editingId,     setEditingId]     = useState(null);
  const [deleteConf,    setDeleteConf]    = useState(null);
  const [showAdminPw,   setShowAdminPw]   = useState(false);
  const [showGroupPw,   setShowGroupPw]   = useState(false);
  const [newPw,         setNewPw]         = useState('');
  const [filterDate,    setFilterDate]    = useState(todayKey());
  const [saving,        setSaving]        = useState(false);
  const [defaultSelect, setDefaultSelect] = useState('');

  const handleSubmit = async () => {
    if (!form.handNo)                            return toast.error('Select a hand');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter valid amount');
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'payments', editingId), {
          handNo: Number(form.handNo), amount: Number(form.amount),
          note: form.note || '', date: form.date,
        });
        toast.success('Payment updated'); setEditingId(null);
      } else {
        await addDoc(collection(db, 'payments'), {
          handNo: Number(form.handNo), amount: Number(form.amount),
          note: form.note || '', date: form.date, createdAt: serverTimestamp(),
        });
        const hand = HANDS.find(h => h.no === Number(form.handNo));
        toast.success(`Logged ${fmt(Number(form.amount))} for ${hand?.name}`);

        // Auto-confirm check-in if exists
        const todayChecks = checkins[todayKey()] || [];
        if (todayChecks.includes(Number(form.handNo))) {
          toast(`Check-in confirmed for ${hand?.name}`, { icon: '✅' });
        }
      }
      setForm({ handNo: '', amount: DAILY_AMOUNT, note: '', date: todayKey() });
    } catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const startEdit = p => {
    setEditingId(p.id);
    setForm({ handNo: String(p.handNo), amount: p.amount, note: p.note || '', date: p.date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deletePayment = async id => {
    try { await deleteDoc(doc(db, 'payments', id)); toast.success('Deleted'); setDeleteConf(null); }
    catch (e) { toast.error(e.message); }
  };

  const markDefault = async () => {
    if (!defaultSelect) return toast.error('Select a hand');
    const no          = Number(defaultSelect);
    const updFines    = { ...fines,    [no]: (fines[no]    || 0) + FINE_AMOUNT };
    const updDefaults = { ...defaults, [no]: (defaults[no] || 0) + 1 };
    await setFinesRemote(updFines);
    await setDefaultsRemote(updDefaults);
    if (updDefaults[no] >= 2) {
      const newOrder = [...order.filter(n => n !== no), no];
      await setOrderRemote(newOrder);
      toast(`Hand moved to end of cycle (2 defaults)`, { icon: '⚠️' });
    }
    toast(`${fmt(FINE_AMOUNT)} fine added for Hand #${no}`, { icon: '⚠️' });
    setDefaultSelect('');
  };

  const changeAdminPw = async () => {
    if (!newPw || newPw.length < 4) return toast.error('Min 4 characters');
    const h = await sha256(newPw.trim());
    await setAdminHashRemote(h);
    setNewPw(''); setShowAdminPw(false);
    toast.success('Admin password changed');
  };

  const changeGroupPw = async () => {
    if (!newPw || newPw.length < 4) return toast.error('Min 4 characters');
    const h = await sha256(newPw.trim());
    await setGroupHashRemote(h);
    setNewPw(''); setShowGroupPw(false);
    toast.success('Group password changed');
  };

  const exportCSV = () => {
    const rows = [['Date', 'Hand No', 'Name', 'Amount', 'Note']];
    [...payments].sort((a, b) => a.date.localeCompare(b.date)).forEach(p => {
      const hand = HANDS.find(h => h.no === p.handNo);
      rows.push([p.date, p.handNo, hand?.name || '', p.amount, p.note || '']);
    });
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'ajohub_payments.csv'; a.click();
    URL.revokeObjectURL(url); toast.success('CSV exported!');
  };

  const paymentsByDate = payments.reduce((acc, p) => { (acc[p.date] = acc[p.date] || []).push(p); return acc; }, {});
  const sortedDates    = Object.keys(paymentsByDate).sort().reverse();

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">
        <Lock size={32} className="text-[#6b7280]" />
      </div>
      <div className="text-center">
        <h2 className="font-display text-2xl text-white mb-2">Admin Only</h2>
        <p className="text-[#6b7280] text-sm">Password required to manage payments</p>
      </div>
      <button className="btn-primary px-8 py-3" onClick={() => setShowGate(true)}>Enter Admin Password</button>
      {showGate && (
        <AdminGate
          adminHashStored={adminHashStored}
          onUnlock={() => { setIsAdmin(true); setShowGate(false); toast.success('Admin unlocked! 🔓'); }}
          onClose={() => setShowGate(false)}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Unlock size={16} className="text-[#22c55e]" />
          <h2 className="font-display text-xl text-white">Admin Panel</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setIsAdmin(false); toast('Session ended 🔒', { icon: '🔒' }); }}
            className="border border-red-500/20 text-red-400 px-3 py-2 rounded-xl text-xs font-medium hover:border-red-400 transition-colors flex items-center gap-1.5">
            <Lock size={11} /> Lock
          </button>
          <button onClick={() => { setNewPw(''); setShowAdminPw(true); }} className="btn-ghost text-xs px-3 py-2">Admin PW</button>
          <button onClick={() => { setNewPw(''); setShowGroupPw(true); }} className="btn-ghost text-xs px-3 py-2">Group PW</button>
          <button onClick={exportCSV} className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Log form */}
      <div className="card p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider">
          {editingId ? 'Edit Payment' : '+ New Payment'}
        </h3>
        <div>
          <label className="text-xs text-[#6b7280] mb-1.5 block">Hand</label>
          <select className="input" value={form.handNo} onChange={e => setForm(f => ({ ...f, handNo: e.target.value }))}>
            <option value="">Select hand...</option>
            {order.map(no => { const h = HANDS.find(x => x.no === no); return h ? <option key={no} value={no}>#{no} -- {h.name}</option> : null; })}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#6b7280] mb-1.5 block">Amount (NGN)</label>
            <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-[#6b7280] mb-1.5 block">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs text-[#6b7280] mb-1.5 block">Note (optional)</label>
          <input type="text" className="input" placeholder="Cash, Transfer..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleSubmit} disabled={saving}>
            {saving && <RefreshCw size={13} className="animate-spin" />}
            {editingId ? 'Update' : 'Log Payment'}
          </button>
          {editingId && (
            <button className="btn-ghost px-4" onClick={() => { setEditingId(null); setForm({ handNo: '', amount: DAILY_AMOUNT, note: '', date: todayKey() }); }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Mark default */}
      <div className="card p-5 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider">Mark Defaulted</h3>
        <div className="flex gap-2">
          <select className="input flex-1" value={defaultSelect} onChange={e => setDefaultSelect(e.target.value)}>
            <option value="">Select hand...</option>
            {order.map(no => { const h = HANDS.find(x => x.no === no); return h ? <option key={no} value={no}>#{no} -- {h.name}</option> : null; })}
          </select>
          <button
            className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap"
            onClick={markDefault}>
            Add Fine
          </button>
        </div>
        <p className="text-xs text-[#6b7280]">Adds {fmt(FINE_AMOUNT)} fine. 2 defaults moves hand to end of cycle.</p>
      </div>

      {/* Fines summary */}
      {Object.keys(fines).length > 0 && (
        <div className="card p-5 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider">Fines Summary</h3>
          {Object.entries(fines).map(([no, amt]) => {
            const hand   = HANDS.find(h => h.no === Number(no));
            const defCnt = defaults[no] || 0;
            return (
              <div key={no} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{hand?.name || `Hand #${no}`}</p>
                  <p className="text-xs text-[#6b7280]">{defCnt} default{defCnt !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-red-400 text-sm font-mono">{fmt(amt)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment history */}
      <div className="card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-wider">Payment History</h3>
          <select
            className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-xs text-[#a3a3a3] focus:outline-none"
            value={filterDate} onChange={e => setFilterDate(e.target.value)}
          >
            <option value="">All dates</option>
            {sortedDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {sortedDates.filter(d => !filterDate || d === filterDate).length === 0 && (
          <p className="text-[#6b7280] text-sm text-center py-4">No payments logged yet</p>
        )}
        {sortedDates.filter(d => !filterDate || d === filterDate).map(date => {
          const pmts     = paymentsByDate[date] || [];
          const dayTotal = pmts.reduce((s, p) => s + p.amount, 0);
          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#6b7280]">{date}</span>
                <span className="text-xs font-mono text-[#22c55e]">{fmt(dayTotal)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {pmts.map(p => {
                  const hand = HANDS.find(h => h.no === p.handNo);
                  return (
                    <div key={p.id} className="card2 p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{hand?.name || `Hand #${p.handNo}`}</p>
                        <p className="text-xs text-[#6b7280]">{p.note || 'Payment'} - {fmt(p.amount)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => startEdit(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#2a2a2a] transition-colors">
                          <Edit2 size={12} className="text-[#6b7280]" />
                        </button>
                        <button onClick={() => setDeleteConf(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors">
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <Modal open={!!deleteConf} onClose={() => setDeleteConf(null)} title="Confirm Delete">
        <div className="flex flex-col gap-4">
          <p className="text-[#a3a3a3] text-sm">Delete this payment? Cannot be undone.</p>
          <div className="flex gap-2">
            <button className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 py-2.5 rounded-xl text-sm font-medium" onClick={() => deletePayment(deleteConf)}>Delete</button>
            <button className="flex-1 btn-ghost" onClick={() => setDeleteConf(null)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={showAdminPw} onClose={() => setShowAdminPw(false)} title="Change Admin Password">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[#6b7280]">This is the password required to log payments and manage the group.</p>
          <input type="password" className="input" placeholder="New admin password (min 4 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} />
          <button className="btn-primary w-full" onClick={changeAdminPw}>Update Admin Password</button>
        </div>
      </Modal>

      <Modal open={showGroupPw} onClose={() => setShowGroupPw(false)} title="Change Group Password">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[#6b7280]">This is the password members use to access AjoHub.</p>
          <input type="password" className="input" placeholder="New group password (min 4 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} />
          <button className="btn-primary w-full" onClick={changeGroupPw}>Update Group Password</button>
        </div>
      </Modal>
    </div>
  );
}

// --- Root App -----------------------------------------------------------------
export default function App() {
  const [groupUnlocked, setGroupUnlocked] = useState(() => !!sessionStorage.getItem('ajo_group_auth'));
  const [tab,           setTab]           = useState('dashboard');
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [online,        setOnline]        = useState(navigator.onLine);

  const [payments,      setPayments]      = useState([]);
  const [order,         setOrder]         = useState(DEFAULT_ORDER);
  const [fines,         setFines]         = useState({});
  const [defaults,      setDefaults]      = useState({});
  const [adminHash,     setAdminHash]     = useState(ENC_ADMIN_DEFAULT);
  const [groupHash,     setGroupHash]     = useState(ENC_GROUP_DEFAULT);
  const [checkins,      setCheckins]      = useState({});
  const [rewardsLog,    setRewardsLog]    = useState([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Payments real-time
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 6000);
    const q       = query(collection(db, 'payments'), orderBy('createdAt', 'asc'));
    const unsub   = onSnapshot(q, snap => {
      clearTimeout(timeout);
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => {
      clearTimeout(timeout);
      if (err.code === 'permission-denied') toast.error('Firestore permission denied -- check Firebase rules');
      else toast.error('Connection error: ' + err.message);
      setLoading(false);
    });
    return () => { clearTimeout(timeout); unsub(); };
  }, []);

  // Settings real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'settings'), snap => {
      snap.docs.forEach(d => {
        const v = d.data().value;
        if (d.id === 'payout_order') setOrder(v);
        if (d.id === 'fines')        setFines(v);
        if (d.id === 'defaults')     setDefaults(v);
        if (d.id === 'admin_hash')   setAdminHash(v);
        if (d.id === 'group_hash')   setGroupHash(v);
        if (d.id === 'checkins')     setCheckins(v);
        if (d.id === 'rewards_log')  setRewardsLog(v);
      });
      setSettingsLoaded(true);
      if (snap.empty) {
        fbSetSetting('payout_order', DEFAULT_ORDER);
        fbSetSetting('fines',        {});
        fbSetSetting('defaults',     {});
        fbSetSetting('admin_hash',   ENC_ADMIN_DEFAULT);
        fbSetSetting('group_hash',   ENC_GROUP_DEFAULT);
        fbSetSetting('checkins',     {});
        fbSetSetting('rewards_log',  []);
      }
    }, err => console.error('Settings error:', err));
    return () => unsub();
  }, []);

  const setOrderRemote      = useCallback(v => fbSetSetting('payout_order', v), []);
  const setFinesRemote      = useCallback(v => fbSetSetting('fines',        v), []);
  const setDefaultsRemote   = useCallback(v => fbSetSetting('defaults',     v), []);
  const setAdminHashRemote  = useCallback(v => fbSetSetting('admin_hash',   v), []);
  const setGroupHashRemote  = useCallback(v => fbSetSetting('group_hash',   v), []);
  const setCheckinsRemote   = useCallback(v => fbSetSetting('checkins',     v), []);
  const setRewardsLogRemote = useCallback(v => fbSetSetting('rewards_log',  v), []);

  const handleGroupUnlock = () => {
    sessionStorage.setItem('ajo_group_auth', '1');
    setGroupUnlocked(true);
  };

  if (!settingsLoaded) return (
    <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[#2a2a2a] border-t-[#22c55e] animate-spin" />
    </div>
  );
  if (!groupUnlocked) return <GroupGate onUnlock={handleGroupUnlock} groupHashStored={groupHash} />;

  const tabs = [
    { id: 'dashboard', label: 'Home',      icon: LayoutDashboard },
    { id: 'hands',     label: 'Hands',     icon: Users            },
    { id: 'checkin',   label: 'Check-in',  icon: ClipboardCheck   },
    { id: 'board',     label: 'Board',     icon: Trophy           },
    { id: 'rewards',   label: 'Rewards',   icon: Gift             },
    { id: 'admin',     label: 'Admin',     icon: ShieldCheck      },
  ];

  return (
    <div className="min-h-dvh bg-[#0a0a0a] font-body">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#1e1e1e', color: '#f5f5f5', border: '1px solid #2a2a2a', borderRadius: '12px', fontSize: '13px' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#0a0a0a' } },
        }}
      />

      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl text-white leading-none">AjoHub</h1>
            <p className="text-[10px] text-[#6b7280] mt-0.5 font-mono">
              Day {getDaysElapsed() + 1} - {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-1.5 bg-[#22c55e]/10 border border-[#22c55e]/20 px-2.5 py-1 rounded-lg">
                <Unlock size={11} className="text-[#22c55e]" />
                <span className="text-[10px] text-[#22c55e] font-medium">Admin</span>
              </div>
            )}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${!online ? 'bg-red-500/10' : ''}`}>
              {online
                ? <><div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" /><span className="text-xs text-[#6b7280]">Live</span></>
                : <><WifiOff size={12} className="text-red-400" /><span className="text-xs text-red-400">Offline</span></>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 pb-32">
        {loading ? <Spinner /> : (
          <>
            {tab === 'dashboard' && <Dashboard payments={payments} order={order} fines={fines} defaults={defaults} checkins={checkins} />}
            {tab === 'hands'     && <HandsTab  payments={payments} order={order} setOrderRemote={setOrderRemote} fines={fines} defaults={defaults} isAdmin={isAdmin} />}
            {tab === 'checkin'   && <CheckinTab payments={payments} checkins={checkins} setCheckinsRemote={setCheckinsRemote} order={order} />}
            {tab === 'board'     && <LeaderboardTab payments={payments} fines={fines} />}
            {tab === 'rewards'   && <RewardsTab payments={payments} fines={fines} isAdmin={isAdmin} rewardsLog={rewardsLog} setRewardsLogRemote={setRewardsLogRemote} />}
            {tab === 'admin'     && (
              <AdminTab
                payments={payments}
                fines={fines}             setFinesRemote={setFinesRemote}
                defaults={defaults}       setDefaultsRemote={setDefaultsRemote}
                order={order}             setOrderRemote={setOrderRemote}
                isAdmin={isAdmin}         setIsAdmin={setIsAdmin}
                adminHashStored={adminHash}   setAdminHashRemote={setAdminHashRemote}
                groupHashStored={groupHash}   setGroupHashRemote={setGroupHashRemote}
                checkins={checkins}       setCheckinsRemote={setCheckinsRemote}
              />
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#1a1a1a]">
        <div className="max-w-lg mx-auto px-2 py-2 flex items-center justify-around">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl transition-all duration-200 min-w-0 flex-1 ${active ? 'text-[#22c55e]' : 'text-[#4a4a4a] hover:text-[#6b7280]'}`}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[9px] font-medium tracking-wide truncate ${active ? 'text-[#22c55e]' : ''}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
