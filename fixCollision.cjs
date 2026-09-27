const fs = require('fs');

const path = '/home/alnesr/.gemini/antigravity/scratch/Airplane-Games/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const startMarker = "      // 3b. Update obstacle bullets movement & collision";
const endMarker = "      if (shieldsChanged) {\n        shieldDropsRef.current = uncollectedShields;\n        setShieldDropIds(uncollectedShields.map(s => s.id));\n      }";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker) + endMarker.length;

if (startIndex === -1 || endIndex < startMarker.length) {
    console.error("Markers not found");
    process.exit(1);
}

const replacement = `      const skyW = window.innerWidth;
      const skyH = window.innerHeight;
      
      const getPxDist = (x1Pct, y1Pct, x2Pct, y2Pct) => {
        const px1 = (x1Pct / 100) * skyW;
        const py1 = skyH - (y1Pct / 100) * skyH;
        const px2 = (x2Pct / 100) * skyW;
        const py2 = skyH - (y2Pct / 100) * skyH;
        return Math.sqrt((px1 - px2)**2 + (py1 - py2)**2);
      };
      
      const checkOverlapPct = (x1, y1, x2, y2, thresholdX, thresholdY) => {
        return Math.abs(x1 - x2) < thresholdX && Math.abs(y1 - y2) < thresholdY;
      };

      // 3b. Update obstacle bullets movement & collision
      const activeBullets = obstacleBulletsRef.current.filter(b => b.x > -10);
      activeBullets.forEach((bullet) => {
        bullet.x -= bullet.speed;
        const bulletEl = document.getElementById(\`bullet-\${bullet.id}\`);
        if (bulletEl) {
          bulletEl.style.left = \`\${bullet.x}%\`;
        }

        // Check collision with player plane
        if (!isInvincibleRef.current && !isFlyingOver) {
          if (getPxDist(planeXRef.current + 5, planeYRef.current + 5, bullet.x, bullet.y) < 42) {
            handleObstacleHit();
            isInvincibleRef.current = true;
            setIsInvincible(true);
            invincibilityTimeRef.current = Date.now() + 1500;
            bullet.x = -20; // Trigger removal
          }
        }
      });

      const cleanBullets = obstacleBulletsRef.current.filter(b => b.x > -10);
      if (cleanBullets.length !== obstacleBulletsRef.current.length) {
        obstacleBulletsRef.current = cleanBullets;
        setBulletIds(cleanBullets.map(b => b.id));
      }

      // 3c. Update clouds movement & collision
      cloudsRef.current.forEach((cloud) => {
        if (!isFlyingOver) {
          cloud.x -= cloud.speed;
          if (cloud.x < -35) {
            cloud.x = 105;
          }
        }

        const cloudEl = document.getElementById(\`cloud-option-\${cloud.idx}\`);
        if (cloudEl) {
          cloudEl.style.left = \`\${cloud.x}%\`;
          cloudEl.style.bottom = \`\${cloud.y}%\`;

          if (!cloud.isActive) {
            cloudEl.style.opacity = '0';
            cloudEl.style.pointerEvents = 'none';
          } else {
            cloudEl.style.opacity = '1';
            cloudEl.style.pointerEvents = isAnswerChecked ? 'none' : 'auto';
          }
        }

        // Check collision with player plane
        if (!isAnswerCheckedRef.current && !isFlyingOver && cloud.isActive) {
          if (checkOverlapPct(planeXRef.current, planeYRef.current, cloud.x, cloud.y, 14, 15)) {
            cloud.isActive = false;
            handleCloudCollision(cloud);
          }
        }
      });

      // 3d. Update player bullets movement & collision with monsters
      const activePlayerBullets = playerBulletsRef.current.filter(b => b.x < 110);
      activePlayerBullets.forEach((bullet) => {
        bullet.x += bullet.speed;
        const bulletEl = document.getElementById(\`player-bullet-\${bullet.id}\`);
        if (bulletEl) {
          bulletEl.style.left = \`\${bullet.x}%\`;
        }

        obstaclesRef.current.forEach((obs) => {
          if (obs.x < 110 && bullet.x < 110) {
            if (getPxDist(bullet.x, bullet.y, obs.x, obs.y) < 45) {
              // Decrement monster health
              obs.hp = (obs.hp || 2) - 1;
              bullet.x = 200; // Trigger bullet removal
              
              const ptX = (obs.x / 100) * skyW;
              const ptY = skyH - (obs.y / 100) * skyH;
              fireExplosion(ptX, ptY, 'red');

              if (obs.hp <= 0) {
                audio.playExplosion();
                const obsEl = document.getElementById(\`obstacle-\${obs.id}\`);
                if (obsEl) obsEl.style.display = 'none';

                // Handle drops
                monstersKilledRef.current += 1;
                if (monstersKilledRef.current >= nextUpgradeKillsRef.current) {
                  const wId = ++weaponDropIdCounterRef.current;
                  weaponDropsRef.current.push({ id: wId, x: obs.x, y: obs.y });
                  setWeaponDropIds(prev => [...prev, wId]);
                  monstersKilledRef.current = 0;
                  nextUpgradeKillsRef.current = 3 + Math.floor(Math.random() * 4);
                } else if (Math.random() < 0.15) {
                  const sId = ++shieldDropIdCounterRef.current;
                  shieldDropsRef.current.push({ id: sId, x: obs.x, y: obs.y });
                  setShieldDropIds(prev => [...prev, sId]);
                } else if (livesRef.current < 3 && Math.random() < 0.3) {
                  const hId = ++heartIdCounterRef.current;
                  heartsRef.current.push({ id: hId, x: obs.x, y: obs.y });
                  setHeartIds(prev => [...prev, hId]);
                }

                // Reset/respawn
                obs.x = 115 + Math.random() * 20;
                obs.y = 15 + Math.random() * 65;
                obs.speed = 0.3 + Math.random() * 0.2;
                obs.hasShot = false;
                obs.hp = 2;
              } else {
                const obsEl = document.getElementById(\`obstacle-\${obs.id}\`);
                if (obsEl) {
                  obsEl.classList.add('hit-flash');
                  setTimeout(() => obsEl.classList.remove('hit-flash'), 100);
                }
              }
            }
          }
        });
      });

      const cleanPlayerBullets = playerBulletsRef.current.filter(b => b.x < 110);
      if (cleanPlayerBullets.length !== playerBulletsRef.current.length) {
        playerBulletsRef.current = cleanPlayerBullets;
        setPlayerBulletIds(cleanPlayerBullets.map(b => b.id));
      }

      // 4. Invincibility cooldown check
      if (isInvincibleRef.current && Date.now() > invincibilityTimeRef.current) {
        isInvincibleRef.current = false;
        setIsInvincible(false);
        if (hasShieldRef.current) {
          hasShieldRef.current = false;
          setHasActiveShield(false);
        }
      }

      // Weapon upgrade cooldown check
      if (weaponLevelRef.current > 1 && Date.now() > weaponUpgradeTimeRef.current) {
        weaponLevelRef.current = 1;
      }

      // 5. Check minion collisions
      if (!isInvincibleRef.current && !isFlyingOver) {
        obstaclesRef.current.forEach((obs) => {
          if (getPxDist(planeXRef.current, planeYRef.current, obs.x, obs.y) < 60) {
            handleObstacleHit();
            isInvincibleRef.current = true;
            setIsInvincible(true);
            invincibilityTimeRef.current = Date.now() + 1500;
          }
        });
      }

      // 6. Update and check collectible hearts
      let activeHearts = heartsRef.current;
      let heartsChanged = false;
      const uncollectedHearts = [];

      activeHearts.forEach(heart => {
        heart.x -= 0.35;
        if (heart.x < -10) { heartsChanged = true; return; }

        if (!isFlyingOver && checkOverlapPct(planeXRef.current, planeYRef.current, heart.x, heart.y, 8, 12)) {
          heartsChanged = true;
          audio.playSuccess();
          setLives(prev => prev < 3 ? prev + 1 : prev);
          setPlaneEffect('boost');
          setTimeout(() => setPlaneEffect('normal'), 500);
          return;
        }
        uncollectedHearts.push(heart);
      });

      if (heartsChanged) {
        heartsRef.current = uncollectedHearts;
        setHeartIds(uncollectedHearts.map(h => h.id));
      }

      // 7. Update and check collectible weapons
      let activeWeapons = weaponDropsRef.current;
      let weaponsChanged = false;
      const uncollectedWeapons = [];

      activeWeapons.forEach(weapon => {
        weapon.x -= 0.35;
        if (weapon.x < -10) { weaponsChanged = true; return; }

        if (!isFlyingOver && checkOverlapPct(planeXRef.current, planeYRef.current, weapon.x, weapon.y, 8, 12)) {
          weaponsChanged = true;
          audio.playSuccess();
          weaponLevelRef.current = Math.min(3, weaponLevelRef.current + 1);
          weaponUpgradeTimeRef.current = Date.now() + 10000;
          setPlaneEffect('boost');
          setTimeout(() => setPlaneEffect('normal'), 500);
          return;
        }
        uncollectedWeapons.push(weapon);
      });

      if (weaponsChanged) {
        weaponDropsRef.current = uncollectedWeapons;
        setWeaponDropIds(uncollectedWeapons.map(w => w.id));
      }

      // 8. Update and check collectible shields
      let activeShields = shieldDropsRef.current;
      let shieldsChanged = false;
      const uncollectedShields = [];

      activeShields.forEach(shield => {
        shield.x -= 0.35;
        if (shield.x < -10) { shieldsChanged = true; return; }

        if (!isFlyingOver && checkOverlapPct(planeXRef.current, planeYRef.current, shield.x, shield.y, 8, 12)) {
          shieldsChanged = true;
          audio.playSuccess();
          isInvincibleRef.current = true;
          setIsInvincible(true);
          hasShieldRef.current = true;
          setHasActiveShield(true);
          invincibilityTimeRef.current = Date.now() + 5000;
          setPlaneEffect('boost');
          setTimeout(() => setPlaneEffect('normal'), 500);
          return;
        }
        uncollectedShields.push(shield);
      });

      if (shieldsChanged) {
        shieldDropsRef.current = uncollectedShields;
        setShieldDropIds(uncollectedShields.map(s => s.id));
      }`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(path, content, 'utf8');
console.log("Replaced successfully!");
