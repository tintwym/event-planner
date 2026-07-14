import React from 'react';
import { motion } from 'motion/react';
import {
  Compass,
  Sparkles,
  Heart,
  Utensils,
  ImageIcon,
  CloudSun,
  ArrowRight,
  MapPin,
  Clock,
  Users,
} from 'lucide-react';
import { CATALOG_ACTIVITIES } from '../data/catalog';

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  // Grab a few highlight activities to display on the landing showcase
  const showcaseActivities = CATALOG_ACTIVITIES.filter((a) =>
    ['w1', 'd1', 'a5'].includes(a.id)
  );

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-primary flex flex-col font-sans selection:bg-gold-premium/30 selection:text-white overflow-x-hidden">
      {/* Upper Brand bar */}
      <header className="border-b border-dark-border/40 py-4 px-6 shrink-0 bg-dark-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gold-premium rounded-full flex items-center justify-center">
              <span className="text-[#0A0A0A] font-bold text-lg font-serif">V</span>
            </div>
            <span className="font-serif font-semibold tracking-wide text-sm text-dark-text-primary italic">
              VILLA &amp; VALE
            </span>
          </div>
          
          <button
            onClick={onEnter}
            className="text-[10px] uppercase tracking-widest font-bold px-4 py-2 border border-gold-premium text-gold-premium hover:bg-gold-premium/10 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            id="landing-quick-enter-btn"
          >
            Enter App <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-6 flex flex-col items-center text-center max-w-5xl mx-auto flex-1 justify-center">
        {/* Subtle Decorative Golden Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-gold-premium/5 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-premium/10 border border-gold-premium/20 text-gold-premium text-[10px] uppercase tracking-widest font-bold">
            <Sparkles className="w-3 h-3 animate-pulse" /> Curated Event Planning &amp; Design
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-light tracking-tight leading-tight max-w-4xl mx-auto text-dark-text-primary">
            Bespoke Celebrations, <br />
            <span className="italic text-gold-premium font-normal">Artfully Customised</span>
          </h1>

          <p className="text-sm md:text-base text-dark-text-secondary max-w-2xl mx-auto font-light leading-relaxed">
            Design your dream itinerary across Amalfi Coast's exclusive private seaside Villas and five-star grand Hotels. Multi-category budget modeling, AI concept mood-board rendering, and live micro-climate forecasts unified under one luxury dashboard.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={onEnter}
              className="px-8 py-3.5 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-gold-premium/10 hover:shadow-gold-premium/20 transition-all cursor-pointer flex items-center justify-center gap-2 group"
              id="landing-hero-cta"
            >
              Start Planning Journey
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href="#features-showcase"
              className="px-8 py-3.5 border border-dark-border hover:border-gold-premium/50 text-dark-text-secondary hover:text-dark-text-primary rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center cursor-pointer"
            >
              Explore Capabilities
            </a>
          </div>
        </motion.div>
      </section>

      {/* Feature Capabilities Grid */}
      <section id="features-showcase" className="py-20 bg-dark-card/30 border-y border-dark-border/40 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-2">
            <h2 className="font-serif text-2xl md:text-3xl font-light text-dark-text-primary">Sophisticated Planning Features</h2>
            <p className="text-xs text-dark-text-secondary uppercase tracking-widest font-bold">Uncompromising tools for perfect event coordination</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4 hover:border-gold-premium/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-gold-premium/10 flex items-center justify-center text-gold-premium">
                <Compass className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              </div>
              <h3 className="font-serif text-lg font-medium text-dark-text-primary">Curated Catalog</h3>
              <p className="text-xs text-dark-text-secondary leading-relaxed font-light">
                Browse our premium collection of pre-configured weddings, sunset dinners, and coastal excursions tailored to high-end locations.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4 hover:border-gold-premium/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="font-serif text-lg font-medium text-dark-text-primary">Bespoke Tailoring</h3>
              <p className="text-xs text-dark-text-secondary leading-relaxed font-light">
                Create custom bespoke events with fine-tuned parameters: set base fees, guest multipliers, operational times, and detailed styling parameters.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4 hover:border-gold-premium/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                <ImageIcon className="w-5 h-5 group-hover:translate-y-[-2px] transition-transform" />
              </div>
              <h3 className="font-serif text-lg font-medium text-dark-text-primary">Gemini AI Imagery</h3>
              <p className="text-xs text-dark-text-secondary leading-relaxed font-light">
                Prompt Google's Gemini models directly to compile high-quality visual concept images representing your specific wedding theme or gala styling.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4 hover:border-gold-premium/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CloudSun className="w-5 h-5 group-hover:animate-pulse transition-transform" />
              </div>
              <h3 className="font-serif text-lg font-medium text-dark-text-primary">Weather Grounding</h3>
              <p className="text-xs text-dark-text-secondary leading-relaxed font-light">
                Retrieve live microclimate weather forecasts directly integrated into the dashboard to guarantee optimal outdoor wedding and dining conditions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Experiences Highlight Showcase */}
      <section className="py-20 px-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-light text-dark-text-primary">Signature Experiences</h2>
            <p className="text-xs text-dark-text-secondary uppercase tracking-widest font-bold mt-1">A glimpse into our luxurious catalogs</p>
          </div>
          <button
            onClick={onEnter}
            className="text-xs font-bold uppercase tracking-wider text-gold-premium hover:text-gold-hover flex items-center gap-1 cursor-pointer shrink-0"
          >
            View Entire Catalog ({CATALOG_ACTIVITIES.length} events) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {showcaseActivities.map((act) => (
            <div
              key={act.id}
              className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden hover:border-gold-premium/30 transition-all duration-300 flex flex-col h-full"
            >
              <div className="h-48 relative overflow-hidden bg-dark-bg shrink-0">
                <img
                  src={act.image}
                  alt={act.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                <span className="absolute top-3 left-3 bg-dark-bg/80 border border-dark-border backdrop-blur-xs text-gold-premium text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded">
                  {act.category}
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="font-serif text-base font-semibold text-dark-text-primary leading-tight">{act.title}</h3>
                  <p className="text-xs text-dark-text-secondary leading-relaxed font-light line-clamp-3">{act.description}</p>
                </div>
                
                <div className="pt-4 border-t border-dark-border/40 mt-4 flex items-center justify-between text-[11px] text-dark-text-tertiary font-medium">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gold-premium" /> {act.location}</span>
                  <span className="font-mono text-gold-premium font-semibold">From ${act.basePrice}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Luxury Footer bar */}
      <footer className="border-t border-dark-border/45 py-8 px-6 text-center text-[10px] text-dark-text-tertiary tracking-widest uppercase mt-auto bg-dark-bg/95">
        <p>© 2026 VILLA &amp; VALE RESORTS. ELEGANT PRIVATE VENUES &amp; CELEBRATIONS.</p>
      </footer>
    </div>
  );
}
