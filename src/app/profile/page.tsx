'use client';

import ProfileForm from '@/components/auth/ProfileForm';
import RouteGuard from '@/components/auth/RouteGuard';

export default function ProfilePage() {
  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <ProfileForm />
      </div>
    </RouteGuard>
  );
}