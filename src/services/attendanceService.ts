import { Session, Attendance, UserProfile } from "../types";
import { neonClient } from "../lib/neon";

// Global Core Attendance Service - Powered by Neon Data API
export const AttendanceService = {
  // 1. Session Operations
  async createSession(
    dbRef: any,
    subjectName: string,
    duration: number,
    latitude: number,
    longitude: number,
    radius: number,
    teacher: UserProfile
  ): Promise<string> {
    try {
      const sessionId = Date.now().toString();
      const expiresAt = new Date(Date.now() + duration * 60000).toISOString();
      
      const { error } = await neonClient.from('class_sessions').insert([{
        id: sessionId,
        subject_name: subjectName,
        duration,
        latitude,
        longitude,
        radius,
        active: true,
        teacher_uid: teacher.uid,
        teacher_name: teacher.name,
        teacher_email: teacher.email,
        expires_at: expiresAt
      }]);
      
      if (error) {
        throw new Error("Failed to create session: " + error.message);
      }
      return sessionId;
    } catch (error) {
      console.error("Neon Data API createSession Error:", error);
      return "";
    }
  },

  async toggleSessionActive(dbRef: any, sessionId: string, active: boolean): Promise<void> {
    try {
      const { error } = await neonClient.from('class_sessions')
        .update({ active })
        .eq('id', sessionId);
        
      if (error) {
        throw new Error("Failed to toggle session active state: " + error.message);
      }
    } catch (error) {
      console.error("Neon Data API toggleSessionActive Error:", error);
    }
  },

  // 2. Real-time Listeners implemented via high-fidelity, light polling
  listenToSessions(dbRef: any, callback: (sessions: Session[]) => void): () => void {
    const fetchSessions = async () => {
      try {
        const { data, error } = await neonClient.from('class_sessions').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          // Map snake_case to camelCase
          const sessions: Session[] = data.map(row => ({
            id: row.id,
            subjectName: row.subject_name,
            duration: row.duration,
            latitude: row.latitude,
            longitude: row.longitude,
            radius: row.radius,
            active: row.active,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            teacherUid: row.teacher_uid,
            teacherName: row.teacher_name,
            teacherEmail: row.teacher_email
          }));
          callback(sessions);
        }
      } catch (err) {
        console.error("Neon Data API listenToSessions Poll Error:", err);
      }
    };

    fetchSessions();
    const intervalId = setInterval(fetchSessions, 3000);
    return () => clearInterval(intervalId);
  },

  listenToAttendances(
    dbRef: any,
    sessionId: string,
    callback: (attendances: Attendance[]) => void
  ): () => void {
    const fetchAttendances = async () => {
      try {
        const { data, error } = await neonClient.from('attendances')
          .select('*')
          .eq('session_id', sessionId)
          .order('timestamp', { ascending: false });
          
        if (!error && data) {
          const attendances: Attendance[] = data.map(row => ({
            id: row.id,
            sessionId: row.session_id,
            studentUid: row.student_uid,
            studentName: row.student_name,
            studentEmail: row.student_email,
            studentId: row.student_id,
            latitude: row.latitude,
            longitude: row.longitude,
            distance: row.distance,
            timestamp: row.timestamp,
            status: row.status as "present" | "late"
          }));
          callback(attendances);
        }
      } catch (err) {
        console.error("Neon Data API listenToAttendances Poll Error:", err);
      }
    };

    fetchAttendances();
    const intervalId = setInterval(fetchAttendances, 3000);
    return () => clearInterval(intervalId);
  },

  // 3. Student Check-in Operation
  async submitCheckIn(
    dbRef: any,
    sessionId: string,
    student: UserProfile,
    coordinates: { latitude: number; longitude: number },
    distance: number,
    status: "present" | "late"
  ): Promise<void> {
    try {
      const attendanceId = Date.now().toString() + Math.floor(Math.random() * 1000);
      
      const { error } = await neonClient.from('attendances').insert([{
        id: attendanceId,
        session_id: sessionId,
        student_uid: student.uid,
        student_name: student.name,
        student_email: student.email,
        student_id: student.studentId || "",
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        distance,
        status
      }]);
      
      if (error) {
        throw new Error("Failed to submit student check-in: " + error.message);
      }
    } catch (error) {
      console.error("Neon Data API submitCheckIn Error:", error);
    }
  },

  // 4. Subject Operations
  async addSubject(dbRef: any, subjectName: string, teacherUid: string): Promise<string> {
    try {
      const subjectId = Date.now().toString();
      const { error } = await neonClient.from('subjects').insert([{
        id: subjectId,
        name: subjectName,
        teacher_uid: teacherUid
      }]);
      
      if (error) {
        throw new Error("Failed to add subject: " + error.message);
      }
      return subjectId;
    } catch (error) {
      console.error("Neon Data API addSubject Error:", error);
      return "";
    }
  },

  async deleteSubject(dbRef: any, subjectId: string): Promise<void> {
    try {
      const { error } = await neonClient.from('subjects')
        .delete()
        .eq('id', subjectId);
        
      if (error) {
        throw new Error("Failed to delete subject: " + error.message);
      }
    } catch (error) {
      console.error("Neon Data API deleteSubject Error:", error);
    }
  },

  listenToSubjects(dbRef: any, teacherUid: string, callback: (subjects: any[]) => void): () => void {
    const fetchSubjects = async () => {
      try {
        const { data, error } = await neonClient.from('subjects')
          .select('*')
          .eq('teacher_uid', teacherUid)
          .order('created_at', { ascending: false });
          
        if (!error && data) {
          // Map if needed, but the original code returned any[] so it's fine.
          const subjects = data.map(row => ({
            id: row.id,
            name: row.name,
            teacherUid: row.teacher_uid,
            createdAt: row.created_at
          }));
          callback(subjects);
        }
      } catch (err) {
        console.error("Neon Data API listenToSubjects Poll Error:", err);
      }
    };

    fetchSubjects();
    const intervalId = setInterval(fetchSubjects, 4000);
    return () => clearInterval(intervalId);
  }
};
