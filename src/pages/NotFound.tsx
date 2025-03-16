import React from "react";
import { Link } from "react-router-dom";

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center px-4 py-16">
      <div className="text-purple-500 text-6xl mb-6">404</div>
      <h1 className="text-4xl font-bold text-white mb-4">Page Not Found</h1>
      <p className="text-gray-300 text-xl mb-8 text-center max-w-md">
        The page you are looking for might have been removed, had its name
        changed, or is temporarily unavailable.
      </p>
      <div className="flex space-x-4">
        <Link to="/" className="btn-primary">
          Go Home
        </Link>
        <button onClick={() => window.history.back()} className="btn-secondary">
          Go Back
        </button>
      </div>

      <div className="mt-12">
        <div className="text-6xl mb-6">🐺</div>
        <p className="text-gray-400 text-center">
          The wolf couldn't find what you're looking for...
        </p>
      </div>
    </div>
  );
};

export default NotFound;
