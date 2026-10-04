#!/bin/sh
# 変異テスト: logic.js へ欠陥を1つずつ入れ、テストが落ちること（fail>0）を確かめる
cd "$(dirname "$0")/.."
cp js/logic.js /tmp/logic.orig
base=$(node --test tests_js/*.test.mjs 2>&1 | grep -E " fail [0-9]" | tr -dc 0-9)
[ "$base" = "0" ] || { echo "baseline not green: fail=$base"; exit 1; }
alive=0
m() { # name, sed-expr
  sed -i "$2" js/logic.js
  if cmp -s js/logic.js /tmp/logic.orig; then echo "NOMATCH  $1"; alive=$((alive+1)); return; fi
  f=$(node --test tests_js/*.test.mjs 2>&1 | grep -E " fail [0-9]" | tr -dc 0-9)
  if [ "$f" = "0" ]; then echo "SURVIVED $1"; alive=$((alive+1)); else echo "killed   $1 (fail=$f)"; fi
  cp /tmp/logic.orig js/logic.js
}
m points-neg      's/d.points < 0/d.points < -1/'
m points-int      's/!isInt(d.points) || //'
m cost-zero       's/r.cost <= 0/r.cost < 0/'
m goal-dup        's/gids.has(g.id)/false/'
m score-max       's/h.totalScore <= 100/h.totalScore <= 101/'
m score-min       's/h.totalScore >= 0/h.totalScore >= -1/'
m hist-key        's/if (!DATE_RE.test(k))/if (false)/'
m hist-scores     's/ || !isObj(h.scores)//'
m bright-max      's/d.brightness <= 85/d.brightness <= 86/'
m exch-short      's/e.cost <= 0/e.cost < 0/'
m exch-nocap      's/.slice(-MAX_EXCHANGES)//'
m exch-le         's/data.points < r.cost/data.points <= r.cost/'
m exch-mutates    's/Object.assign({}, data, {/Object.assign(data, {/'
m exch-nofind     's/if (!r) return/if (false) return/'
m remind-14       's/>= 14/> 14/'
m wall-http       's#/^https:#/^https?:#'
m wall-chars      's/\x27"()\\\\//'
m wall-data       's/(jpeg|png|webp|gif)/(jpeg|png|webp|gif|html)/'
m wall-nocheck    's/safeWallpaper(d.wallpaper) === null/false/'
m backup-date     's/!DATE_RE.test(d.lastBackup)/false/'
m tie-rule        's/finalScore >= maxPast/finalScore > maxPast/'
m zero-points     's/ && finalScore > 0;/;/'
# past-empty（past.length === 0 の分岐を消す変異）は、maxPast=0 で finalScore>=0 となり結果が同じ等価変異。入れない
m eval-empty      's/if (goalIds.length === 0) return null;//'
m eval-valid      's/v !== 100 \&\& v !== 50 \&\& v !== 0/v === undefined/'
m eval-zero       's/v !== 100 \&\& v !== 50 \&\& v !== 0/!v/'
m eval-round      's/Math.round(sum \/ goalIds.length)/Math.floor(sum \/ goalIds.length)/'
m ios-standalone  's/if (standalone) return false;//'
m ios-ua          's#/iPhone|iPad|iPod/#/iPhone|iPod/#'
m ios-ipados      's/maxTouchPoints > 1/true/'
m ver-int         's/!isInt(obj.version) || //'
m ver-min         's/obj.version < 1/obj.version < 0/'
m ver-newer       's/obj.version > BACKUP_VERSION/obj.version > 99/'
m ver-export      's/version: BACKUP_VERSION/version: 2/'
echo "alive=$alive"
