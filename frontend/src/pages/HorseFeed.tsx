import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { feedApi, horsesApi } from '../services/api';
import type { Horse, FeedSummary, UpdateFeedRequirement } from '../types';
import './HorseFeed.css';

export function HorseFeed() {
  const { horseId } = useParams<{ horseId: string }>();
  const navigate = useNavigate();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [summary, setSummary] = useState<FeedSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Feed requirement form
  const [feedForm, setFeedForm] = useState<UpdateFeedRequirement>({
    morning_feed: '',
    evening_feed: '',
  });

  const loadData = async () => {
    if (!horseId) return;
    setIsLoading(true);
    try {
      const [horseData, summaryData] = await Promise.all([
        horsesApi.get(parseInt(horseId)),
        feedApi.getSummary(parseInt(horseId)),
      ]);
      setHorse(horseData);
      setSummary(summaryData);

      // Populate feed form
      if (summaryData.feed_requirement) {
        setFeedForm({
          morning_feed: summaryData.feed_requirement.morning_feed || '',
          evening_feed: summaryData.feed_requirement.evening_feed || '',
        });
      }
    } catch {
      setError('Failed to load feed data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horseId]);

  const handleSaveFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;
    try {
      await feedApi.updateRequirement(parseInt(horseId), feedForm);
      setIsEditing(false);
      await loadData();
    } catch {
      setError('Failed to save feed requirements');
    }
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  if (!horse || !summary) {
    return <div className="ds-alert ds-alert-error">Horse not found</div>;
  }

  return (
    <div className="horse-feed-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/book/my-horses')}>
          &larr; Back to My Horses
        </button>
        <h1>{horse.name} - Feed</h1>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      <div className="requirements-section">
        {isEditing ? (
          <form onSubmit={handleSaveFeed} className="feed-form">
            <div className="ds-form-group">
              <label>Morning Feed</label>
              <textarea
                value={feedForm.morning_feed}
                onChange={(e) => setFeedForm({ ...feedForm, morning_feed: e.target.value })}
                placeholder="List each item and quantity, e.g.:&#10;1 scoop Happy Hoof&#10;1 scoop Baileys Lo-Cal&#10;1 tbsp salt"
                rows={5}
              />
            </div>
            <div className="ds-form-group">
              <label>Evening Feed</label>
              <textarea
                value={feedForm.evening_feed}
                onChange={(e) => setFeedForm({ ...feedForm, evening_feed: e.target.value })}
                placeholder="List each item and quantity, e.g.:&#10;2 scoops Happy Hoof&#10;1 scoop Baileys Lo-Cal"
                rows={5}
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setIsEditing(false)} className="ds-btn ds-btn-secondary">
                Cancel
              </button>
              <button type="submit" className="ds-btn ds-btn-primary">
                Save
              </button>
            </div>
          </form>
        ) : (
          <div className="feed-display">
            <div className="feed-section-header">
              <h2>Daily Feed Chart</h2>
              <button onClick={() => setIsEditing(true)} className="edit-btn">
                Edit
              </button>
            </div>

            <div className="feed-cards">
              <div className="feed-card">
                <h3>Morning Feed</h3>
                <pre>{summary.feed_requirement?.morning_feed || 'Not specified'}</pre>
              </div>
              <div className="feed-card">
                <h3>Evening Feed</h3>
                <pre>{summary.feed_requirement?.evening_feed || 'Not specified'}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
