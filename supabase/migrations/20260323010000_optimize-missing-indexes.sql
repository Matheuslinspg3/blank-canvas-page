-- Optimize missing indexes for hot paths
-- property_images.property_id: used in LEFT JOIN on every property listing page load
CREATE INDEX IF NOT EXISTS idx_property_images_property_id
  ON property_images(property_id);

-- appointments.assigned_to + start_time: hot path for broker schedule queries
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to_start
  ON appointments(assigned_to, start_time);
