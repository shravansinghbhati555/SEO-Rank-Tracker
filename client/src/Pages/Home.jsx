import Hero from "../Components/home/Hero";
import Features from "../Components/home/Features";
import HowItWorks from "../Components/home/HowltWorks";
import Pricing from "../Components/home/Pricing";
import Footer from "../Components/home/Footer";

export default function Home() {
    return (
        <div className="min-h-screen">
            <Hero />
            <Features />
            <HowItWorks />
            <Pricing />
            <Footer />
        </div>
    );
}