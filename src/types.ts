export type UserRole = "teacher" | "student";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string; // Standard Thai Student ID (e.g. 64010123)
  photoURL?: string; // Google avatar photo URL
}

export interface Session {
  id: string;
  subjectName: string;
  duration: number; // in minutes
  latitude: number; // Classroom center
  longitude: number;
  radius: number; // in meters (default 10)
  active: boolean;
  createdAt: string; // ISO String
  expiresAt: string; // ISO String
  teacherUid: string;
  teacherName: string;
  teacherEmail: string;
}

export interface Attendance {
  id: string; // usually studentUid_sessionId
  sessionId: string;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  studentId: string;
  latitude: number; // checked-in GPS latitude
  longitude: number; // checked-in GPS longitude
  distance: number; // distance in meters from classroom center
  timestamp: string; // ISO String
  status: "present" | "late";
}
