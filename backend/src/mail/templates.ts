// Centralized HTML email templates for all automated emails.
const wrap = (title: string, body: string): string => `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:#1f4e79;color:#fff;padding:18px 24px;font-size:18px;font-weight:700">${title}</div>
    <div style="padding:24px;color:#334155;font-size:14px;line-height:1.6">${body}</div>
    <div style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:12px">ALGORIX — Project Management & ERP Platform</div>
  </div>`;

export const templates = {
  otp: (otp: string) =>
    wrap(
      'Password Reset Code',
      `<p>Use the following One-Time Password to reset your password:</p>
       <p style="font-size:26px;font-weight:800;letter-spacing:4px;color:#1f4e79">${otp}</p>
       <p>This code expires in 10 minutes. If you didn’t request it, ignore this email.</p>`,
    ),

  newSignupRequest: (name: string, email: string) =>
    wrap(
      'New Developer Signup Request',
      `<p>A new developer has requested access:</p>
       <p><b>${name}</b><br/>${email}</p>
       <p>Review and approve/reject it from your CTO dashboard → <b>Signup Requests</b>.</p>`,
    ),

  signupApproved: (name: string, email: string, password: string) =>
    wrap(
      'Your Developer Account is Approved',
      `<p>Hi ${name},</p>
       <p>Welcome aboard! Your developer account has been approved.</p>
       <table style="margin:12px 0">
         <tr><td style="color:#64748b">Login email</td><td style="padding-left:12px"><b>${email}</b></td></tr>
         <tr><td style="color:#64748b">Temporary password</td><td style="padding-left:12px"><b>${password}</b></td></tr>
       </table>
       <p>Please log in and change your password immediately.</p>`,
    ),

  // Applicant set their own password at signup — don't email a password.
  signupApprovedSelfSet: (name: string, email: string) =>
    wrap(
      'Your Account is Approved',
      `<p>Hi ${name},</p>
       <p>Welcome aboard! Your account has been approved.</p>
       <table style="margin:12px 0">
         <tr><td style="color:#64748b">Login email</td><td style="padding-left:12px"><b>${email}</b></td></tr>
       </table>
       <p>Log in with the password you chose when you signed up.</p>`,
    ),

  signupRejected: (name: string, note?: string) =>
    wrap(
      'Your Developer Application',
      `<p>Hi ${name},</p>
       <p>Thank you for your interest. Unfortunately your application was not approved at this time.</p>
       ${note ? `<p style="color:#64748b">Note: ${note}</p>` : ''}`,
    ),

  taskAssigned: (taskTitle: string) =>
    wrap(
      'New Task Assigned',
      `<p>A task has been assigned to you:</p><p><b>${taskTitle}</b></p>
       <p>Check your dashboard for details.</p>`,
    ),

  leaveDecision: (status: string) =>
    wrap(
      `Leave ${status}`,
      `<p>Your leave application has been <b>${status.toLowerCase()}</b>.</p>`,
    ),
};
