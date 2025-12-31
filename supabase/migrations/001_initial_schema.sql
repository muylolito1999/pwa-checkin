-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table: Event configuration
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    access_code TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guests table: Guest list with soft delete
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    notes TEXT,
    phone TEXT,
    "group" TEXT,
    ticket_code TEXT,
    stable_key TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, stable_key)
);

-- Checkins table: Immutable check-in log
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id),
    guest_id UUID NOT NULL REFERENCES guests(id),
    checked_in_at TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    device_id TEXT NOT NULL,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_guests_event_id ON guests(event_id);
CREATE INDEX idx_guests_stable_key ON guests(stable_key);
CREATE INDEX idx_guests_is_deleted ON guests(is_deleted);
CREATE INDEX idx_checkins_event_guest ON checkins(event_id, guest_id);
CREATE INDEX idx_checkins_time ON checkins(checked_in_at);
CREATE INDEX idx_checkins_type ON checkins(type);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to events
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to guests
CREATE TRIGGER update_guests_updated_at
    BEFORE UPDATE ON guests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Enable but allow all for now
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Policies for anon access (with access code validation done in app)
CREATE POLICY "Allow all access to events" ON events FOR ALL USING (true);
CREATE POLICY "Allow all access to guests" ON guests FOR ALL USING (true);
CREATE POLICY "Allow all access to checkins" ON checkins FOR ALL USING (true);

-- Insert default NYE Party 2025 event
INSERT INTO events (name, date, access_code)
VALUES ('NYE Party 2025', '2025-12-31', 'nye2025');
