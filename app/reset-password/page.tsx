// app/reset-password/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated successfully!");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-xl font-semibold mb-4">Set New Password</h1>

      <form onSubmit={handleUpdate} className="space-y-4">
        <input
          type="password"
          placeholder="New password"
          className="w-full p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="w-full bg-black text-white p-2 rounded">
          Update Password
        </button>
      </form>

      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  );
}