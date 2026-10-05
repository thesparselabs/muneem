import Navbar from './components/Navbar.tsx';
import Hero from './components/Hero.tsx';
import Features from './components/Features.tsx';
import ProductTabs from './components/ProductTabs.tsx';
import Why from './components/Why.tsx';
import Faq from './components/Faq.tsx';
import { Cta, Footer } from './components/CtaFooter.tsx';

export default function App() {
  return (
    <div className="relative">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <ProductTabs />
        <Why />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
