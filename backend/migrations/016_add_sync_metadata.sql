-- Migration: Add wise_sync_metadata table for tracking sync operations
-- Created: 2025-10-29
-- Purpose: Track incremental sync progress and enable scheduled syncs

-- Store sync tracking information
CREATE TABLE IF NOT EXISTS wise_sync_metadata (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update timestamp automatically on value changes
CREATE OR REPLACE FUNCTION update_sync_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wise_sync_metadata_timestamp
    BEFORE UPDATE ON wise_sync_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_sync_metadata_timestamp();

-- Initial values for sync tracking
-- last_sync_timestamp: ISO timestamp of last successful sync (start with 1 year ago)
-- sync_enabled: Enable/disable scheduled syncs
-- sync_count: Number of syncs completed
-- last_sync_stats: JSON stats from last sync
INSERT INTO wise_sync_metadata (key, value) VALUES
    ('last_sync_timestamp', (NOW() - INTERVAL '1 year')::TEXT),
    ('sync_enabled', 'true'),
    ('sync_count', '0'),
    ('last_sync_stats', '{}')
ON CONFLICT (key) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE wise_sync_metadata IS 'Stores metadata for Wise API sync operations including last sync timestamp, enabled status, and statistics';
COMMENT ON COLUMN wise_sync_metadata.key IS 'Metadata key (last_sync_timestamp, sync_enabled, sync_count, last_sync_stats)';
COMMENT ON COLUMN wise_sync_metadata.value IS 'Metadata value stored as text (use TEXT for JSON values)';
COMMENT ON COLUMN wise_sync_metadata.updated_at IS 'Timestamp of last update to this metadata value';
