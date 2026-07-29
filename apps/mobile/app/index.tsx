import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { useAuth } from '../src/lib/auth';
import { colors } from '../src/theme';

export default function Index() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.black} />
      </ScreenContainer>
    );
  }

  return <Redirect href="/prefectures" />;
}
