import React from "react";

interface RolePopularityProps {
  roleStats: Record<string, number>;
  totalGames: number;
}

const RolePopularity: React.FC<RolePopularityProps> = ({
  roleStats,
  totalGames,
}) => {
  // Sort roles by play count in descending order
  const sortedRoles = Object.entries(roleStats).sort(
    ([, countA], [, countB]) => countB - countA
  );

  return (
    <div className="bg-gray-800 rounded-lg p-6 pixel-container mb-8">
      <h2 className="text-xl font-bold mb-6 text-white">Role Popularity</h2>

      {sortedRoles.length === 0 ? (
        <p className="text-gray-400">No role data available for this period.</p>
      ) : (
        <div className="space-y-4">
          {sortedRoles.map(([role, count]) => {
            const percentage =
              totalGames > 0 ? Math.round((count / totalGames) * 100) : 0;

            // Different colors for different role types
            let barColor = "bg-gray-600";
            if (role === "Werewolf") barColor = "bg-red-600";
            else if (role === "Seer" || role === "Doctor")
              barColor = "bg-blue-600";
            else if (role === "Villager") barColor = "bg-green-600";
            else if (role === "Hunter") barColor = "bg-yellow-600";

            return (
              <div key={role}>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-300">{role}</span>
                  <span className="text-gray-400">
                    {count} games ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className={`${barColor} h-4 rounded-sm pixel-border`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RolePopularity;
