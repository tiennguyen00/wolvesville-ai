import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="px-6 py-4 bg-gray-800">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold text-purple-500">Wolvesville</div>
          <div>
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary">
                Dashboard
              </Link>
            ) : (
              <div className="space-x-4">
                <Link to="/login" className="btn-secondary">
                  Login
                </Link>
                <Link to="/register" className="btn-primary">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 lg:pr-10">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 animate-fade-in">
              Welcome to <span className="text-purple-500">Wolvesville</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 animate-fade-in">
              Join the ultimate social deduction game where villagers and
              werewolves face off in a battle of wits and deception.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 animate-fade-in">
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="btn-primary text-center">
                    Go to Dashboard
                  </Link>
                  <Link to="/games" className="btn-primary text-center">
                    Find Games
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn-primary text-center">
                    Start Playing Now
                  </Link>
                  <Link to="/about" className="btn-secondary text-center">
                    Learn More
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="md:w-1/2 mt-10 md:mt-0">
            <div className="bg-gray-800 rounded-xl p-4 shadow-2xl">
              <img
                src="/wolf-illustration.svg"
                alt="Wolvesville Game"
                className="rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src =
                    "https://placehold.co/600x400/000/FFF?text=Wolvesville";
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-800 py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">
            Game Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card transform hover:scale-105 transition-transform">
              <div className="text-purple-500 text-4xl mb-4">🐺</div>
              <h3 className="text-xl font-bold mb-2">Multiple Roles</h3>
              <p className="text-gray-300">
                Choose from over 40 unique roles, each with special abilities
                that affect gameplay.
              </p>
            </div>
            <div className="card transform hover:scale-105 transition-transform">
              <div className="text-purple-500 text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-bold mb-2">Competitive Gameplay</h3>
              <p className="text-gray-300">
                Climb the ranks, earn rewards, and become the ultimate
                Wolvesville player.
              </p>
            </div>
            <div className="card transform hover:scale-105 transition-transform">
              <div className="text-purple-500 text-4xl mb-4">💬</div>
              <h3 className="text-xl font-bold mb-2">Real-time Chat</h3>
              <p className="text-gray-300">
                Discuss, deceive, and discover who's who through our advanced
                chat system.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-xl font-bold text-purple-500 mb-4 md:mb-0">
              Wolvesville
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white">
                Terms
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                Privacy
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                Contact
              </a>
            </div>
          </div>
          <div className="mt-8 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Wolvesville. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
