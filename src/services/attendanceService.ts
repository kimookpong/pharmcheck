import { Session, Attendance, UserProfile } from "../types";

// Global Core Attendance Service - Powered by Neon PostgreSQL & Express API
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
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectName,
          duration,
          latitude,
          longitude,
          radius,
          teacherUid: teacher.uid,
          teacherName: teacher.name,
          teacherEmail: teacher.email
        })
      });
      if (!response.ok) {
        throw new Error("Failed to create session on PostgreSQL server");
      }
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error("PostgreSQL createSession Error:", error);
      return "";
    }
  },

  async toggleSessionActive(dbRef: any, sessionId: string, active: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active })
      });
      if (!response.ok) {
        throw new Error("Failed to toggle session active state");
      }
    } catch (error) {
      console.error("PostgreSQL toggleSessionActive Error:", error);
    }
  },

  // 2. Real-time Listeners implemented via high-fidelity, light polling
  listenToSessions(dbRef: any, callback: (sessions: Session[]) => void): () => void {
    const fetchSessions = async () => {
      try {
        const response = await fetch("/api/sessions");
        if (response.ok) {
          const sessions = await response.json();
          callback(sessions);
        }
      } catch (err) {
        console.error("PostgreSQL listenToSessions Poll Error:", err);
      }
    };

    // Initial invoke
    fetchSessions();

    const intervalId = setInterval(fetchSessions, 3000);

    return () => {
      clearInterval(intervalId);
    };
  },

  listenToAttendances(
    dbRef: any,
    sessionId: string,
    callback: (attendances: Attendance[]) => void
  ): () => void {
    const fetchAttendances = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/attendances`);
        if (response.ok) {
          const attendances = await response.json();
          callback(attendances);
        }
      } catch (err) {
        console.error("PostgreSQL listenToAttendances Poll Error:", err);
      }
    };

    // Initial invoke
    fetchAttendances();

    const intervalId = setInterval(fetchAttendances, 3000);

    return () => {
      clearInterval(intervalId);
    };
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
      const response = await fetch(`/api/sessions/${sessionId}/attendances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentUid: student.uid,
          studentName: student.name,
          studentEmail: student.email,
          studentId: student.studentId || "",
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          distance,
          status
        })
      });
      if (!response.ok) {
        throw new Error("Failed to submit student check-in");
      }
    } catch (error) {
      console.error("PostgreSQL submitCheckIn Error:", error);
    }
  },

  // 4. Subject Operations
  async addSubject(dbRef: any, subjectName: string, teacherUid: string): Promise<string> {
    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subjectName,
          teacherUid
        })
      });
      if (!response.ok) {
        throw new Error("Failed to add subject");
      }
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error("PostgreSQL addSubject Error:", error);
      return "";
    }
  },

  async deleteSubject(dbRef: any, subjectId: string): Promise<void> {
    try {
      const response = await fetch(`/api/subjects/${subjectId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Failed to delete subject");
      }
    } catch (error) {
      console.error("PostgreSQL deleteSubject Error:", error);
    }
  },

  listenToSubjects(dbRef: any, teacherUid: string, callback: (subjects: any[]) => void): () => void {
    const fetchSubjects = async () => {
      try {
        const response = await fetch(`/api/subjects?teacherUid=${teacherUid}`);
        if (response.ok) {
          const subjects = await response.json();
          callback(subjects);
        }
      } catch (err) {
        console.error("PostgreSQL listenToSubjects Poll Error:", err);
      }
    };

    // Initial invoke
    fetchSubjects();

    const intervalId = setInterval(fetchSubjects, 4000);

    return () => {
      clearInterval(intervalId);
    };
  }
};
