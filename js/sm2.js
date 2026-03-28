/**
 * LexReview - SM-2 Algorithm
 * Implementation of the SuperMemo SM-2 spaced repetition algorithm.
 */

const SM2 = (() => {

  /**
   * Calculate new review data based on quality rating.
   * @param {Object} reviewData - Current card review data
   * @param {number} quality - Rating 0-5 (0=Esqueci, 3=Difícil, 4=Bom, 5=Fácil)
   * @returns {Object} Updated review data
   */
  function calculate(reviewData, quality) {
    let { repetitions, easinessFactor, intervalDays, consecutiveFails } = reviewData;
    const today = new Date().toISOString().split('T')[0];

    // Calculate new easiness factor
    let newEF = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEF = Math.max(1.3, newEF);

    let newInterval;
    let newReps;

    if (quality < 3) {
      // Failed: reset
      newReps = 0;
      newInterval = 1;
      consecutiveFails = (consecutiveFails || 0) + 1;
    } else {
      consecutiveFails = 0;
      newReps = repetitions + 1;

      switch (newReps) {
        case 1:
          newInterval = 1;
          break;
        case 2:
          newInterval = 3;
          break;
        case 3:
          newInterval = 7;
          break;
        default:
          newInterval = Math.round(intervalDays * newEF);
          break;
      }
    }

    // Calculate next review date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);
    const nextReview = nextDate.toISOString().split('T')[0];

    // Build new review history entry
    const historyEntry = { date: today, quality };

    return {
      repetitions: newReps,
      easinessFactor: Math.round(newEF * 100) / 100,
      intervalDays: newInterval,
      nextReview,
      lastReview: today,
      consecutiveFails,
      reviewHistory: [...(reviewData.reviewHistory || []), historyEntry]
    };
  }

  /**
   * Build a review session queue with quota-based priority.
   * @param {Array} cards - All cards
   * @param {Object} config - App config with quotas
   * @returns {Array} Ordered array of cards for review
   */
  function buildSessionQueue(cards, config) {
    const today = new Date().toISOString().split('T')[0];
    const maxCards = config.maxCardsPerSession || 20;
    const quotas = config.quotas || { overdue: 8, learning: 6, new: 4, mature: 2 };
    const retirementDays = config.retirementThresholdDays || 90;
    const leechThreshold = config.leechThreshold || 5;

    // Categorize due cards
    const buckets = { overdue: [], learning: [], new: [], mature: [] };

    cards.forEach(card => {
      const rd = card.reviewData;
      if (rd.nextReview > today) return; // Not due

      // Skip retired cards
      if (rd.intervalDays >= retirementDays) return;

      // Categorize
      if (rd.repetitions === 0 && !rd.lastReview) {
        buckets.new.push(card);
      } else if (rd.nextReview < today) {
        buckets.overdue.push(card);
      } else if (rd.intervalDays >= 21) {
        buckets.mature.push(card);
      } else {
        buckets.learning.push(card);
      }
    });

    // Sort within each bucket
    // Overdue: most overdue first
    buckets.overdue.sort((a, b) => a.reviewData.nextReview.localeCompare(b.reviewData.nextReview));
    // Learning: lowest interval first
    buckets.learning.sort((a, b) => a.reviewData.intervalDays - b.reviewData.intervalDays);
    // New: oldest added first
    buckets.new.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));
    // Mature: soonest due first
    buckets.mature.sort((a, b) => a.reviewData.nextReview.localeCompare(b.reviewData.nextReview));

    // Fill session with quota limits
    const queue = [];
    const priorities = ['overdue', 'learning', 'new', 'mature'];

    priorities.forEach(cat => {
      const quota = quotas[cat] || 0;
      const available = buckets[cat].slice(0, quota);
      queue.push(...available);
    });

    // If under max, fill remaining slots from overflow
    if (queue.length < maxCards) {
      const remaining = maxCards - queue.length;
      const queueIds = new Set(queue.map(c => c.id));
      const overflow = [];
      priorities.forEach(cat => {
        buckets[cat].forEach(card => {
          if (!queueIds.has(card.id)) overflow.push(card);
        });
      });
      queue.push(...overflow.slice(0, remaining));
    }

    return queue.slice(0, maxCards);
  }

  /**
   * Get category stats for all cards.
   */
  function getCategoryStats(cards, config) {
    const retirementDays = config.retirementThresholdDays || 90;
    const leechThreshold = config.leechThreshold || 5;
    const stats = { new: 0, learning: 0, mature: 0, retired: 0, leech: 0 };

    cards.forEach(card => {
      const rd = card.reviewData;
      if ((rd.consecutiveFails || 0) >= leechThreshold) {
        stats.leech++;
      } else if (rd.repetitions === 0 && !rd.lastReview) {
        stats.new++;
      } else if (rd.intervalDays >= retirementDays) {
        stats.retired++;
      } else if (rd.intervalDays >= 21) {
        stats.mature++;
      } else {
        stats.learning++;
      }
    });

    return stats;
  }

  /**
   * Get retention rate from review history.
   */
  function getRetentionRate(cards) {
    let total = 0;
    let passed = 0;
    cards.forEach(card => {
      (card.reviewData.reviewHistory || []).forEach(r => {
        total++;
        if (r.quality >= 3) passed++;
      });
    });
    return total > 0 ? Math.round((passed / total) * 100) : 0;
  }

  /**
   * Get average quality from review history.
   */
  function getAverageQuality(cards) {
    let total = 0;
    let sum = 0;
    cards.forEach(card => {
      (card.reviewData.reviewHistory || []).forEach(r => {
        total++;
        sum += r.quality;
      });
    });
    return total > 0 ? Math.round((sum / total) * 100) / 100 : 0;
  }

  return {
    calculate,
    buildSessionQueue,
    getCategoryStats,
    getRetentionRate,
    getAverageQuality
  };
})();
