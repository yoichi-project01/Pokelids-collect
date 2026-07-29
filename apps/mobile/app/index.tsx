import { Redirect } from 'expo-router';
import Head from 'expo-router/head';
import { ActivityIndicator } from 'react-native';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { useAuth } from '../src/lib/auth';
import { colors } from '../src/theme';

export default function Index() {
  const { isLoading } = useAuth();

  const head = (
    <Head>
      <title>ポケふた収集</title>
    </Head>
  );

  if (isLoading) {
    return (
      <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
        {head}
        <ActivityIndicator size="large" color={colors.black} />
      </ScreenContainer>
    );
  }

  return (
    <>
      {head}
      <Redirect href="/prefectures" />
    </>
  );
}
