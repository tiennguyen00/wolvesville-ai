import React from "react";

interface Achievement {
  id: number;
  name: string;
  description: string;
  unlocked: boolean;
  date?: string;
}

interface AchievementsProps {
  achievements: Achievement[];
}

const Achievements: React.FC<AchievementsProps> = ({ achievements }) => {
  // Group achievements by unlock status
  const unlockedAchievements = achievements.filter((a) => a.unlocked);
  const lockedAchievements = achievements.filter((a) => !a.unlocked);

  return (
    <div className="bg-gray-800 rounded-lg p-6 pixel-container">
      <h2 className="text-xl font-bold mb-6 text-white">Achievements</h2>

      <div className="mb-4">
        <p className="text-gray-400 mb-2">
          {unlockedAchievements.length} of {achievements.length} Unlocked
        </p>
        <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className="bg-yellow-500 h-4 pixel-border"
            style={{
              width: `${
                (unlockedAchievements.length / achievements.length) * 100
              }%`,
            }}
          ></div>
        </div>
      </div>

      <div className="space-y-6">
        {unlockedAchievements.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-yellow-400 pixel-text">
              Unlocked
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unlockedAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="bg-gray-700/50 p-4 rounded-lg border border-yellow-600/50 pixel-border"
                >
                  <div className="flex">
                    <div className="mr-3 flex-shrink-0">
                      <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center">
                        <span className="text-yellow-200">✓</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-yellow-300">
                        {achievement.name}
                      </h4>
                      <p className="text-sm text-gray-300">
                        {achievement.description}
                      </p>
                      {achievement.date && (
                        <p className="text-xs text-gray-400 mt-1">
                          Unlocked on {achievement.date}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {lockedAchievements.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-400 pixel-text">
              Locked
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lockedAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="bg-gray-700/20 p-4 rounded-lg border border-gray-600/50 pixel-border"
                >
                  <div className="flex">
                    <div className="mr-3 flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-gray-400">?</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-400">
                        {achievement.name}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Achievements;
