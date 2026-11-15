import { useScorer } from './lib/useScorer';
import { Nav } from './components/Nav';
import { Hero } from './sections/Hero';
import { Checker } from './sections/Checker';
import { Question } from './sections/Question';
import { Methodology } from './sections/Methodology';
import { Dataset } from './sections/Dataset';
import { ModelComparison } from './sections/ModelComparison';
import { Lab } from './sections/Lab';
import { Results } from './sections/Results';
import { ErrorAnalysis } from './sections/ErrorAnalysis';
import { Conclusion } from './sections/Conclusion';
import { Reproducibility } from './sections/Reproducibility';
import { Footer } from './sections/Footer';

export default function App() {
  const { status, score } = useScorer();

  return (
    <>
      <div className="ambient" aria-hidden />
      <div className="grain" aria-hidden />
      <Nav />
      <main>
        <Hero status={status} />
        <Question />
        <Dataset />
        <Methodology />
        <ModelComparison />
        <Results />
        <Lab />
        <ErrorAnalysis />
        <Conclusion />
        <hr className="divider" />
        <Checker status={status} score={score} />
        <Reproducibility />
      </main>
      <Footer />
    </>
  );
}
