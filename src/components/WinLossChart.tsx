import React from "react";

interface WinLossChartProps {
  wins: number;
  total: number;
}

const WinLossChart: React.FC<WinLossChartProps> = ({ wins, total }) => {
  // Calculate percentages
  const winPercentage = total > 0 ? Math.round((wins / total) * 100) : 0;
  const lossPercentage = 100 - winPercentage;

  // Only show chart if there are games played
  if (total === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 pixel-container mb-8">
        <h2 className="text-xl font-bold mb-2 text-white">Win/Loss Ratio</h2>
        <p className="text-gray-400">No games played during this period.</p>
      </div>
    );
  }

  // Calculate circle segment (using conic-gradient)
  const conicGradient = `conic-gradient(
    #9333ea 0% ${winPercentage}%, 
    #64748b ${winPercentage}% 100%
  )`;

  return (
    <div className="bg-gray-800 rounded-lg p-6 pixel-container mb-8">
      <h2 className="text-xl font-bold mb-4 text-white">Win/Loss Ratio</h2>

      <div className="flex flex-col items-center mb-4">
        {/* Circle chart */}
        <div
          className="w-36 h-36 rounded-full mb-4 pixel-border"
          style={{ background: conicGradient }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-purple-400">
                {winPercentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-8 w-full max-w-xs">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-purple-600 rounded-sm mr-2"></div>
            <div>
              <div className="text-white">{wins} Wins</div>
              <div className="text-xs text-gray-400">{winPercentage}%</div>
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-500 rounded-sm mr-2"></div>
            <div>
              <div className="text-white">{total - wins} Losses</div>
              <div className="text-xs text-gray-400">{lossPercentage}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WinLossChart;
