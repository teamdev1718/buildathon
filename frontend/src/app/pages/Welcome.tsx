import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/auth';
import { useApp } from '../lib/app-context';
import { animalLabel, dateText, inr, monthlyEstimate, payModeLabel, shareText, splitName, type AnimalType, type MyProgram, type PayMode } from '../lib/programs';
import { Stepper } from '../ui/booking';
import { ErrorNote, Loading, useAction, useFetch } from '../ui/kit';
import { HouseholdLink } from './Join';

export const skipKey = 'udhiyya-onboarding-skipped';
type Step = 'household' | 'programme' | 'animal' | 'payment' | 'shares' | 'done';
const titles: Record<Step, string> = { household: 'Your household', programme: 'Programme', animal: 'Animal', payment: 'Payment', shares: 'Shares', done: 'Done' };

function Option({ selected, onSelect, title, detail, aside }: { selected: boolean; onSelect(): void; title: string; detail?: string; aside?: string }) {
  return <button type="button" role="radio" aria-checked={selected} className={'am-option' + (selected ? ' on' : '')} onClick={onSelect}>
    <span className="am-radio" aria-hidden="true" />
    <span className="am-option-text"><b>{title}</b>{detail && <span>{detail}</span>}</span>
    {aside && <span className="am-option-aside">{aside}</span>}
  </button>;
}

/** The first-login questions, one per slide: programme, animal, how to pay, how many shares. */
export function Welcome() {
  const { user } = useAuth();
  const { ctx, reload, toast } = useApp();
  const navigate = useNavigate();
  const programs = useFetch<MyProgram[]>(ctx?.households.length ? '/me/programs' : null);
  const { busy, error, run, setError } = useAction();
  const [at, setAt] = useState(0);
  const [programId, setProgramId] = useState('');
  const [animal, setAnimal] = useState<AnimalType | ''>('');
  const [payMode, setPayMode] = useState<PayMode | ''>('');
  const [shares, setShares] = useState(1);

  const linked = (ctx?.households.length ?? 0) > 0;
  const steps: Step[] = [...(linked ? [] : ['household' as const]), 'programme', 'animal', 'payment', 'shares', 'done'];
  const step = steps[Math.min(at, steps.length - 1)];
  const open = (programs.data ?? []).filter(item => item.status === 'OPEN');
  const program = open.find(item => item.id === programId) ?? (open.length === 1 ? open[0] : undefined);
  const chosen = program?.animals.find(item => item.animalType === animal);
  const total = chosen ? shares * chosen.sharePrice : 0;
  const plan = program ? monthlyEstimate(total, program.payBy) : null;
  const unit = chosen && chosen.sharesPerAnimal === 1 ? { one: 'animal', many: 'animals' } : { one: 'share', many: 'shares' };

  const canContinue = step === 'household' ? linked : step === 'programme' ? Boolean(program) : step === 'animal' ? Boolean(chosen) : step === 'payment' ? Boolean(payMode) : true;
  const go = (to: number) => { setError(''); setAt(to); };
  const skip = () => { sessionStorage.setItem(skipKey, '1'); navigate('/app', { replace: true }); };

  const confirm = () => run(async () => {
    if (!program || !chosen || !payMode) return;
    await api(`/programs/${program.id}/bookings`, 'POST', { householdId: program.household.id, animalType: chosen.animalType, shares, payMode }, true);
    toast('Your booking is confirmed');
    go(steps.indexOf('done'));
  });

  return <div className="am-welcome">
    <header className="am-welcome-head">
      <div><div className="eyebrow"><span className="dot" />WELCOME{user ? ', ' + user.name.split(' ')[0].toUpperCase() : ''}</div>
        <h1 style={{ marginTop: 10 }}>Let’s set up your <span className="serif">Udhiyya.</span></h1></div>
      {step !== 'done' && <button type="button" className="chipbtn" onClick={skip}>Skip for now</button>}
    </header>

    <ol className="am-dots" aria-label="Progress">{steps.slice(0, -1).map((item, index) => <li key={item} className={index < at ? 'done' : index === at ? 'now' : ''} aria-current={index === at ? 'step' : undefined}>
      <i /><span>{titles[item]}</span></li>)}</ol>

    <div className="am-slides"><div className="am-slides-track" style={{ transform: `translateX(-${Math.min(at, steps.length - 1) * 100}%)` }}>
      {steps.map((item, index) => <section key={item} className="am-slide" aria-hidden={index !== at} inert={index !== at}>
        {item === 'household' && <>
          <h2>Link your <span className="serif">household</span></h2>
          <p className="am-lead">Enter the mahallu number and phone your committee has on record for your house.</p>
          <div className="card" style={{ maxWidth: 520 }}><HouseholdLink done={() => { void reload(); go(0); }} /></div></>}

        {item === 'programme' && <>
          <h2>Which <span className="serif">programme</span>?</h2>
          <p className="am-lead">Pick the Udhiyya your mahallu is running.</p>
          {programs.loading && !programs.data ? <Loading /> : !programs.data ? <ErrorNote message={programs.error} /> : open.length === 0 ?
            <div className="card empty"><h3>No programme is open yet</h3><p>Your mahallu committee has not started one. You can come back any time.</p></div> :
            <div className="am-options" role="radiogroup" aria-label="Programme">{open.map(entry => <Option key={entry.id} selected={program?.id === entry.id}
              onSelect={() => { setProgramId(entry.id); setAnimal(''); }} title={entry.name} detail={`${entry.mahalluName} · Udhiyya on ${dateText(entry.targetDate)}`} aside={`Pay by ${dateText(entry.payBy)}`} />)}</div>}</>}

        {item === 'animal' && <>
          <h2>Which <span className="serif">animal</span>?</h2>
          <p className="am-lead">Choose the animal for your Udhiyya.</p>
          <div className="am-options" role="radiogroup" aria-label="Animal">{(program?.animals ?? []).filter(entry => entry.enabled).map(entry =>
            <Option key={entry.animalType} selected={animal === entry.animalType} onSelect={() => setAnimal(entry.animalType)} title={animalLabel[entry.animalType]}
              detail={shareText(entry.sharesPerAnimal)} aside={`${inr(entry.sharePrice)} per ${entry.sharesPerAnimal === 1 ? 'animal' : 'share'}`} />)}</div></>}

        {item === 'payment' && <>
          <h2>How will you <span className="serif">pay</span>?</h2>
          <p className="am-lead">You can pay a little each month, or all at once. Either way it is finished by {program ? dateText(program.payBy) : 'the pay-by date'}.</p>
          <div className="am-options" role="radiogroup" aria-label="Payment type">
            <Option selected={payMode === 'INSTALLMENTS'} onSelect={() => setPayMode('INSTALLMENTS')} title="Installments" detail="Spread the cost over the months that are left." />
            <Option selected={payMode === 'ONE_TIME'} onSelect={() => setPayMode('ONE_TIME')} title="One-time payment" detail="Pay the full amount in one go." /></div></>}

        {item === 'shares' && <>
          <h2>How many <span className="serif">{unit.many}</span>?</h2>
          <p className="am-lead">{chosen && chosen.sharesPerAnimal > 1 ? `A ${animalLabel[chosen.animalType].toLowerCase()} is shared by up to ${chosen.sharesPerAnimal} people. Take as many shares as your family needs.` : 'Choose how many animals you would like.'}</p>
          <div className="am-summary">
            <Stepper value={shares} onChange={setShares} label={unit.many} singular={unit.one} disabled={busy} />
            {program && chosen && payMode && <div className="card am-recap">
              <div className="kv"><span>Programme</span><b>{program.name}</b></div>
              <div className="kv"><span>Animal</span><b>{animalLabel[chosen.animalType]}</b></div>
              <div className="kv"><span>Payment</span><b>{payModeLabel[payMode]}</b></div>
              <div className="kv"><span>Total</span><b>{inr(total)}</b></div>
              {payMode === 'INSTALLMENTS' && plan && <div className="kv"><span>About</span><b>{inr(plan.monthly)} a month for {plan.months} {plan.months === 1 ? 'month' : 'months'}</b></div>}
            </div>}
          </div>
          {error && <p className="am-error" role="alert">{error}</p>}</>}

        {item === 'done' && <div className="am-done">
          <div className="am-tick" aria-hidden="true"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></div>
          <h2>You are <span className="serif">all set.</span></h2>
          <p className="am-lead">{program && chosen ? `${shares} ${shares === 1 ? unit.one : unit.many} of ${animalLabel[chosen.animalType].toLowerCase()} in ${splitName(program.name).join('')}. ` : ''}You can pay and follow progress from your dashboard.</p>
          <button type="button" className="pillbtn" onClick={() => navigate('/app', { replace: true })}>Go to my dashboard</button></div>}
      </section>)}
    </div></div>

    {step !== 'done' && <footer className="am-welcome-actions">
      <button type="button" className="pillbtn ghost" disabled={at === 0 || busy} onClick={() => go(at - 1)}>Back</button>
      {step === 'shares' ? <button type="button" className="pillbtn" disabled={busy || !program || !chosen || !payMode} onClick={() => void confirm()}>{busy ? 'Booking…' : 'Confirm booking'}</button> :
        step === 'household' ? null : <button type="button" className="pillbtn" disabled={!canContinue} onClick={() => go(at + 1)}>Continue</button>}
    </footer>}
  </div>;
}
