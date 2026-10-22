import { useRouter } from 'expo-router';
import { AddressEditor } from '@/components/AddressEditor';
import { apiRequest } from '@/lib/api';
import type { Address } from '@/lib/types';

export default function AddAddressScreen() {
  const router = useRouter();
  return (
    <AddressEditor
      mode="add"
      onBack={() => router.back()}
      onSubmit={async (values) => {
        await apiRequest<Address>('/addresses', {
          method: 'POST',
          body: {
            label: values.label,
            line1: values.line1,
            ...(values.line2 ? { line2: values.line2 } : {}),
            city: values.city,
            state: values.state,
            pincode: values.pincode,
          },
        });
        router.back();
      }}
    />
  );
}
