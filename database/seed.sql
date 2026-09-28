-- CampusCare Database Seed Data (Development / Demo Use Only)
-- Note: Do NOT run against production environments with real data.

SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO departments (id, name, description) VALUES
  (1, 'Administration', 'Administrative support and policy workflows'),
  (2, 'Hostel', 'Residential and hostel management operations'),
  (3, 'Electrical', 'Power supply and electrical maintenance'),
  (4, 'Plumbing', 'Water supply and sanitation maintenance'),
  (5, 'Library', 'Library facilities and academic resources'),
  (6, 'IT Support', 'Wi-Fi and digital infrastructure support'),
  (7, 'Security', 'Campus safety and access control')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT INTO categories (id, name, description, department_id, is_active) VALUES
  (1, 'Hostel', 'Issues related to hostel rooms, facilities, or accommodation', 2, TRUE),
  (2, 'Classroom', 'Classroom and academic space concerns', 1, TRUE),
  (3, 'Electrical', 'Power, electrical installation, and lighting issues', 3, TRUE),
  (4, 'Plumbing', 'Water and sanitation-related complaints', 4, TRUE),
  (5, 'Internet/Wi-Fi', 'Connectivity and network complaints', 6, TRUE),
  (6, 'Library', 'Book, study room, and library environment issues', 5, TRUE),
  (7, 'Cleanliness', 'Hygiene and campus cleanliness concerns', NULL, TRUE),
  (8, 'Transportation', 'Bus and transport service issues', NULL, TRUE),
  (9, 'Canteen', 'Food, hygiene, and canteen service concerns', NULL, TRUE),
  (10, 'Security', 'Security and safety concerns', 7, TRUE),
  (11, 'Other', 'Other campus-related complaints', NULL, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  department_id = VALUES(department_id),
  is_active = VALUES(is_active);

INSERT INTO users (id, name, email, password, phone, role, department_id, status) VALUES
  (1, 'Demo Administrator', 'admin@campus.edu', '$2a$10$hacWbZzGcvzlVnuJV8Kwre27NJBtHNHNMLoOnY9ldDbnGjxzg2y9G', '9000012345', 'admin', 1, 'Active'),
  (2, 'Demo Electrical Staff', 'staff1@campus.edu', '$2a$10$sASffGw1UjcTRxj/cB7kaunCU9hJGnzyWey0x2onaozs.4Y4WYRNu', '9000012346', 'staff', 3, 'Active'),
  (3, 'Demo Plumbing Staff', 'staff2@campus.edu', '$2a$10$sASffGw1UjcTRxj/cB7kaunCU9hJGnzyWey0x2onaozs.4Y4WYRNu', '9000012347', 'staff', 4, 'Active'),
  (4, 'Demo Student One', 'student1@campus.edu', '$2a$10$PhaZTQyWWBE2fqcLPVoMwOymHpt8yS9og3PZ2nf7FRzqGmh7efKLO', '9000012348', 'student', NULL, 'Active'),
  (5, 'Demo Student Two', 'student2@campus.edu', '$2a$10$PhaZTQyWWBE2fqcLPVoMwOymHpt8yS9og3PZ2nf7FRzqGmh7efKLO', '9000012349', 'student', NULL, 'Active'),
  (6, 'Demo Student Three', 'student3@campus.edu', '$2a$10$PhaZTQyWWBE2fqcLPVoMwOymHpt8yS9og3PZ2nf7FRzqGmh7efKLO', '9000012350', 'student', NULL, 'Active'),
  (7, 'Demo Student Four', 'student4@campus.edu', '$2a$10$PhaZTQyWWBE2fqcLPVoMwOymHpt8yS9og3PZ2nf7FRzqGmh7efKLO', '9000012351', 'student', NULL, 'Active'),
  (8, 'Demo Student Five', 'student5@campus.edu', '$2a$10$PhaZTQyWWBE2fqcLPVoMwOymHpt8yS9og3PZ2nf7FRzqGmh7efKLO', '9000012352', 'student', NULL, 'Active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  email = VALUES(email),
  password = VALUES(password),
  phone = VALUES(phone),
  role = VALUES(role),
  department_id = VALUES(department_id),
  status = VALUES(status);

INSERT INTO complaints (
  id, complaint_number, user_id, category_id, title, description, location,
  priority, status, assigned_department_id, assigned_staff_id,
  created_at, updated_at, resolved_at
) VALUES
  (1, 'CMP-2026-00001', 4, 3, 'Classroom fan not working', 'The ceiling fan in room A-204 is not functioning and it is very hot in the class.', 'A-204, Engineering Block', 'High', 'In Progress', 3, 2, '2026-09-01 08:00:00', '2026-09-04 10:00:00', NULL),
  (2, 'CMP-2026-00002', 5, 4, 'Washroom pipe leaking', 'The pipe in the second-floor washroom is leaking and water is spilling onto the floor.', 'Second Floor Washroom, Main Block', 'Urgent', 'Assigned', 4, 3, '2026-09-03 09:00:00', '2026-09-04 11:00:00', NULL),
  (3, 'CMP-2026-00003', 6, 5, 'Wi-Fi signal weak in library', 'Internet connectivity is poor in the library during evening hours.', 'Library Building', 'Medium', 'Resolved', 6, NULL, '2026-09-05 09:00:00', '2026-09-09 14:00:00', '2026-09-09 14:00:00'),
  (4, 'CMP-2026-00004', 7, 7, 'Campus cleanliness issue', 'The garden area near the canteen is dirty and there are overflowing bins.', 'Near Canteen', 'Medium', 'Submitted', NULL, NULL, '2026-09-06 10:00:00', '2026-09-06 10:00:00', NULL),
  (5, 'CMP-2026-00005', 8, 10, 'Visitor gate security concern', 'The security gate is not checking visitors properly in the evening.', 'Main Entrance', 'High', 'Under Review', 7, NULL, '2026-09-08 11:00:00', '2026-09-09 12:00:00', NULL)
ON DUPLICATE KEY UPDATE
  complaint_number = VALUES(complaint_number),
  user_id = VALUES(user_id),
  category_id = VALUES(category_id),
  title = VALUES(title),
  description = VALUES(description),
  location = VALUES(location),
  priority = VALUES(priority),
  status = VALUES(status),
  assigned_department_id = VALUES(assigned_department_id),
  assigned_staff_id = VALUES(assigned_staff_id),
  created_at = VALUES(created_at),
  updated_at = VALUES(updated_at),
  resolved_at = VALUES(resolved_at);

INSERT INTO complaint_status_history (
  id, complaint_id, previous_status, new_status, changed_by, remark, created_at
) VALUES
  (1, 1, NULL, 'Submitted', 4, 'Complaint submitted by student.', '2026-09-01 08:00:00'),
  (2, 1, 'Submitted', 'Under Review', 1, 'Complaint accepted for review by admin.', '2026-09-02 09:00:00'),
  (3, 1, 'Under Review', 'Assigned', 1, 'Assigned to Electrical department.', '2026-09-03 09:00:00'),
  (4, 1, 'Assigned', 'In Progress', 2, 'Technician started checking the room fan issue.', '2026-09-04 10:00:00'),
  (5, 2, NULL, 'Submitted', 5, 'Complaint submitted by student.', '2026-09-03 09:00:00'),
  (6, 2, 'Submitted', 'Under Review', 1, 'Complaint reviewed and forwarded.', '2026-09-04 10:00:00'),
  (7, 2, 'Under Review', 'Assigned', 1, 'Assigned to Plumbing department.', '2026-09-04 11:00:00'),
  (8, 3, NULL, 'Submitted', 6, 'Complaint submitted by student.', '2026-09-05 09:00:00'),
  (9, 3, 'Submitted', 'Under Review', 1, 'Complaint recorded and reviewed.', '2026-09-06 09:00:00'),
  (10, 3, 'Under Review', 'Assigned', 1, 'Assigned to IT Support.', '2026-09-07 09:00:00'),
  (11, 3, 'Assigned', 'In Progress', 2, 'Wi-Fi issue investigation started.', '2026-09-08 10:00:00'),
  (12, 3, 'In Progress', 'Resolved', 2, 'Network issue fixed and verified.', '2026-09-09 14:00:00'),
  (13, 4, NULL, 'Submitted', 7, 'Complaint submitted by student.', '2026-09-06 10:00:00'),
  (14, 5, NULL, 'Submitted', 8, 'Complaint submitted by student.', '2026-09-08 11:00:00'),
  (15, 5, 'Submitted', 'Under Review', 1, 'Complaint is being reviewed.', '2026-09-09 12:00:00')
ON DUPLICATE KEY UPDATE
  complaint_id = VALUES(complaint_id),
  previous_status = VALUES(previous_status),
  new_status = VALUES(new_status),
  changed_by = VALUES(changed_by),
  remark = VALUES(remark),
  created_at = VALUES(created_at);

INSERT INTO feedback (id, complaint_id, user_id, rating, comment) VALUES
  (1, 3, 6, 5, 'The issue was resolved quickly and the support team was helpful.')
ON DUPLICATE KEY UPDATE
  complaint_id = VALUES(complaint_id),
  user_id = VALUES(user_id),
  rating = VALUES(rating),
  comment = VALUES(comment);

INSERT INTO notifications (id, user_id, complaint_id, title, message, is_read) VALUES
  (1, 4, 1, 'Complaint Updated', 'Your complaint status changed to In Progress.', FALSE),
  (2, 6, 3, 'Complaint Resolved', 'Your complaint has been resolved.', FALSE),
  (3, 3, 2, 'New Complaint Assigned', 'A new complaint was assigned to your department.', FALSE)
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  complaint_id = VALUES(complaint_id),
  title = VALUES(title),
  message = VALUES(message),
  is_read = VALUES(is_read);

SET FOREIGN_KEY_CHECKS = 1;
