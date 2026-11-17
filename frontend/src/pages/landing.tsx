import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import { Bars, FloatCard, Heading, Icon, Meter, Phone, Row, Tag, type IconName } from '../features/landing/parts';
import { useReveal } from '../features/landing/reveal';
import '../features/landing/landing.css';

const chips = ['Goat', 'Sheep', 'Cow share', 'Camel share', 'Cash', 'UPI', 'Monthly installments', 'Price lock',
  'Meat tokens', 'Pickup slots', 'Home delivery', 'Collector desk'];
const words = ['Save', 'Pay', 'Share', 'Distribute'];

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: 'calendar', title: 'Monthly installments', text: 'Pick your shares and pay a small amount each month. The plan price is split over the months left.' },
  { icon: 'wallet', title: 'Cash or UPI', text: 'Pay a mahal collector in cash, or send UPI and share the reference for confirmation.' },
  { icon: 'users', title: 'Funds held by your mahal', text: 'Your mahal committee holds the money and buys the animals once the price is locked.' },
  { icon: 'truck', title: 'Fair meat distribution', text: 'Tokens, pickup slots and home delivery keep collection day calm, even with hundreds of families.' },
];

const bento: { icon: IconName; title: string; text: string }[] = [
  { icon: 'calendar', title: 'Monthly Installments', text: 'Start right after one Udhiyya and save for the next.' },
  { icon: 'tag', title: 'Price Lock', text: 'A fixed date when prices are final and animals are bought.' },
  { icon: 'bell', title: 'Gentle Reminders', text: 'Email or Telegram nudges when an installment is due.' },
  { icon: 'shield', title: 'Collector Desk', text: 'Volunteers record cash and confirm UPI payments.' },
];

const faqs = [
  ['How is my monthly amount decided?', 'The price of your shares is divided by the whole months left before the price lock date. Joining later means a higher monthly amount, so joining early is easiest on the budget.'],
  ['Who holds the money?', 'Your mahal committee. It sets the refund and price rules, and the app keeps a clear record of every payment.'],
  ['Can I pay online?', 'Yes. Send a UPI payment, enter its reference in the app, and a collector confirms it. Cash is recorded directly by a collector.'],
  ['How do I get my share of the meat?', 'Fully paid members get a token with a pickup slot. Show the code to a volunteer on collection day. The elderly and sick can be put on the home delivery list.'],
];

function Nav() {
  const { user } = useAuth();
  return <header className="lp-nav"><nav aria-label="Main navigation">
    <Link to="/" className="lp-brand"><span className="lp-logo">U</span>Udhiyya Saver</Link>
    <div className="lp-links"><a href="#how">How it works</a><a href="#plans">Plans</a><a href="#distribution">Distribution</a><a href="#faq">FAQ</a></div>
    <div className="lp-nav-cta">{user ? <Link className="lp-btn lp-btn-green" to="/app">Open Udhiyya</Link> : <>
      <Link className="lp-login" to="/login">Log in</Link>
      <Link className="lp-btn lp-btn-green" to="/register">Get Started</Link></>}</div>
  </nav></header>;
}

function Hero() {
  const { user } = useAuth();
  return <section className="lp-hero">
    <Nav />
    <div className="lp-hero-copy">
      <Tag>Mahal-run Udhiyya savings</Tag>
      <Heading as="h1" className="lp-h1" bold="Udhiyya," italic="Made Easier, One Month at a Time." />
      <p>Udhiyya Saver lets families save for their share in small monthly installments, and helps your mahal buy animals and distribute the meat with less effort and more trust.</p>
      <div className="lp-actions">
        <Link className="lp-btn lp-btn-white" to={user ? '/app' : '/register'}>Get Started</Link>
        <a className="lp-btn lp-btn-ghost" href="#how">See how it works</a>
      </div>
    </div>
    <div className="lp-stage">
      <div className="lp-arc" />
      <FloatCard className="lp-float-l"><span className="lp-dot lp-dot-mid"><Icon name="check" size={16} /></span>
        <span><b>Installment received</b><small>Cash · Mahal collector</small></span><strong>+₹500</strong></FloatCard>
      <Phone className="lp-hero-phone">
        <div className="lp-greet"><span className="lp-avatar">FA</span><span><small>Assalamu alaikum</small><b>Fathima</b></span></div>
        <div className="lp-balance"><small>Saved for Udhiyya</small><b>₹3,000</b><Meter percent={50} label="50 percent saved" /><small>of ₹6,000 · goat share</small></div>
        <Row icon="check" title="Installment" sub="Cash · Today" value="+₹500" tone="mid" />
        <Row icon="calendar" title="Next due" sub="1 December" value="₹500" tone="light" />
        <Row icon="shield" title="Standing" sub="Mahal collector" value="On track" tone="dark" />
      </Phone>
      <FloatCard className="lp-float-r"><small className="lp-mono">Udhiyya goal</small><b>Family goat share</b>
        <Meter percent={50} label="Goal progress" /><small>6 of 12 installments paid</small></FloatCard>
    </div>
  </section>;
}

function Marquees() {
  const loop = [...chips, ...chips];
  const text = [...words, ...words, ...words, ...words];
  return <section className="lp-marquees" aria-label="Highlights">
    <div className="lp-chips" aria-hidden="true"><div className="lp-track">{loop.map((chip, index) => <span key={index}>{chip}</span>)}</div></div>
    <div className="lp-big" aria-hidden="true"><div className="lp-track lp-track-slow">
      {text.map((word, index) => <span key={index}>{word}<i /></span>)}</div></div>
  </section>;
}

function Overview() {
  return <section className="lp-section" id="how">
    <div className="lp-center" data-reveal><Tag>Platform overview</Tag>
      <Heading bold="Built for Better" italic="Udhiyya Management" />
      <p>One simple platform connects families, collectors and the mahal committee from the first installment to the last packet of meat.</p></div>
    <div className="lp-split">
      <div className="lp-panel-green" data-reveal>
        <span className="lp-pill"><Icon name="users" size={16} />Your mahal, one platform</span>
        <Phone className="lp-split-phone">
          <h3>My Udhiyya</h3><small>Udhiyya 1448</small>
          <div className="lp-segments"><span /><span /><span /><span /></div>
          <Row icon="wallet" title="Goat share" sub="2 of 12 installments" value="₹1,000" tone="dark" />
          <Row icon="tag" title="Price lock" sub="1 Shawwal" value="Set" tone="mid" />
          <Row icon="qr" title="Meat token" sub="After Udhiyya" value="Soon" tone="light" />
        </Phone>
      </div>
      <div className="lp-panel-white" data-reveal>
        <Tag>Platform features</Tag>
        <Heading bold="Everything You Need." italic="Nothing You Don’t." />
        <p>Join, pay and collect without chasing anyone on a messaging group.</p>
        <ul className="lp-feature-list" data-stagger>{features.map(item => <li key={item.title}>
          <span className="lp-icon-box"><Icon name={item.icon} /></span>
          <span><b>{item.title}</b><small>{item.text}</small></span><Icon name="arrow" size={16} /></li>)}</ul>
      </div>
    </div>
  </section>;
}

function Bento() {
  return <section className="lp-section lp-soft" id="plans">
    <div className="lp-center" data-reveal><Tag>Udhiyya management</Tag>
      <Heading bold="Know Where Your" italic="Udhiyya Goes." />
      <p>Every rupee is recorded. Families see their own progress and the committee sees the whole cycle, so there are no surprises on price lock day.</p></div>
    <div className="lp-bento" data-stagger>
      <article className="lp-card lp-card-big">
        <header><span><small className="lp-mono">Collected · this cycle</small><b className="lp-money">₹3,48,260</b></span>
          <span className="lp-chip-ok"><Icon name="check" size={12} />72% of target</span></header>
        <Bars values={[30, 42, 36, 55, 48, 66, 40, 58, 62, 44, 70, 52, 88, 56]} highlight={12} />
        {[['Goat shares', 78], ['Cow shares', 64], ['Sheep shares', 41]].map(([name, percent]) => <div className="lp-plan" key={name}>
          <div><span className="lp-dot lp-dot-dark"><Icon name="tag" size={14} /></span><b>{name}</b><span>{percent}% paid</span></div>
          <Meter percent={Number(percent)} label={`${name} ${percent} percent paid`} /></div>)}
        <small className="lp-note">Sample figures for illustration.</small>
      </article>
      {bento.map(item => <article className="lp-card lp-card-small" key={item.title}>
        <span className="lp-icon-box"><Icon name={item.icon} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}
    </div>
  </section>;
}

function Guidance() {
  return <section className="lp-section">
    <div className="lp-center" data-reveal><Tag>Udhiyya guidance</Tag>
      <Heading bold="Your Udhiyya Journey," italic="Made Simpler." />
      <p>Understand your installments, check what you owe and get answers from the built-in assistant.</p></div>
    <div className="lp-guide" data-reveal>
      <div className="lp-rings" aria-hidden="true" />
      <FloatCard className="lp-guide-l"><span className="lp-mono lp-green">Reminder</span>
        <b>Your installment of ₹500 is due this month.</b></FloatCard>
      <Phone className="lp-guide-phone">
        <div className="lp-greet"><span className="lp-avatar"><Icon name="spark" size={16} /></span><span><b>Udhiyya assistant</b><small>Ready to help</small></span></div>
        <p className="lp-bubble lp-bubble-user">How is my monthly amount decided?</p>
        <p className="lp-bubble">The price of your shares is divided by the months left before the price lock date.</p>
      </Phone>
      <FloatCard className="lp-guide-r"><span className="lp-mono lp-green">Standing</span>
        <b>You are on track. Only 6 installments to go.</b></FloatCard>
    </div>
  </section>;
}

function Community() {
  return <section className="lp-section lp-soft" id="distribution">
    <div className="lp-center" data-reveal><Tag>Distribution</Tag>
      <Heading bold="Your Mahal," italic="Working Together." />
      <p>Tokens, slots and a live collection count turn a busy day into a smooth one, even as more families join.</p></div>
    <div className="lp-trio" data-stagger>
      <Phone className="lp-trio-side lp-trio-left">
        <h3>Collector desk</h3><small className="lp-mono">Today</small>
        <Row icon="wallet" title="Cash recorded" sub="Fathima · Goat share" value="₹500" tone="dark" />
        <Row icon="check" title="UPI confirmed" sub="Yusuf · Cow share" value="₹1,200" tone="mid" />
        <Row icon="bell" title="UPI waiting" sub="Ayisha" value="₹500" tone="light" />
      </Phone>
      <Phone className="lp-trio-mid">
        <h3>Meat distribution</h3><small>Collected so far</small>
        <b className="lp-money">132 / 180</b><span className="lp-chip-ok"><Icon name="check" size={12} />Live count</span>
        <Bars values={[18, 24, 30, 36, 44, 52, 58, 66, 72, 80, 86, 92]} highlight={11} />
        <div className="lp-times"><span>08:00</span><span className="on">09:00</span><span>10:00</span><span>11:00</span></div>
      </Phone>
      <Phone className="lp-trio-side lp-trio-right">
        <h3>Home delivery</h3><small className="lp-mono">By area</small>
        <Row icon="home" title="North" sub="4 families" value="Pending" tone="light" />
        <Row icon="home" title="South" sub="3 families" value="Out" tone="mid" />
        <Row icon="home" title="Market road" sub="2 families" value="Done" tone="dark" />
      </Phone>
    </div>
  </section>;
}

function Faq() {
  return <section className="lp-section" id="faq">
    <div className="lp-center" data-reveal><Tag>Questions</Tag><Heading bold="Good to" italic="Know." /></div>
    <div className="lp-faq" data-stagger>{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
  </section>;
}

function Cta() {
  const { user } = useAuth();
  return <section className="lp-cta" data-reveal>
    <Tag dark>Get started</Tag>
    <Heading bold="A Better Way to" italic="Run Udhiyya Starts Here." />
    <p>Join your mahal’s cycle today, pay a little each month and be ready when Udhiyya arrives.</p>
    <div className="lp-actions">
      <Link className="lp-btn lp-btn-white" to={user ? '/app' : '/register'}>{user ? 'Open Udhiyya' : 'Create an account'}</Link>
      {!user && <Link className="lp-btn lp-btn-ghost" to="/login">Sign in</Link>}
    </div>
    <small>Your mahal committee holds the funds and sets the rules.</small>
    <div className="lp-cta-cards" aria-hidden="true">
      <div className="lp-tilt lp-tilt-l"><Icon name="qr" size={44} /><b>Meat token</b><small>Show it on collection day</small></div>
      <div className="lp-tilt lp-tilt-r"><b className="lp-money">100%</b><small>of payments recorded and visible to you</small></div>
    </div>
  </section>;
}

function Footer() {
  return <footer className="lp-footer">
    <div className="lp-footer-card" data-reveal>
      <div className="lp-footer-top">
        <div><b className="lp-footer-title">Udhiyya management, made simple.</b>
          <p>Udhiyya Saver connects families, collectors and your mahal committee through one transparent platform.</p></div>
        <nav aria-label="Footer">
          <div><h3>Product</h3><a href="#how">How it works</a><a href="#plans">Plans</a><a href="#distribution">Distribution</a></div>
          <div><h3>Account</h3><Link to="/register">Create account</Link><Link to="/login">Sign in</Link><Link to="/app">My Udhiyya</Link></div>
          <div><h3>Help</h3><a href="#faq">FAQ</a><Link to="/profile">Notifications</Link></div>
        </nav>
      </div>
      <div className="lp-footer-bottom"><span>© 2026 Udhiyya Saver. Built at the buildathon.</span></div>
    </div>
    <div className="lp-wordmark" aria-hidden="true">UDHIYYA</div>
  </footer>;
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return <div className="lp" ref={root}><Hero /><Marquees /><Overview /><Bento /><Guidance /><Community /><Faq /><Cta /><Footer /></div>;
}
