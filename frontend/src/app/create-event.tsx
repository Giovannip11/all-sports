import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsButton } from '@/components/design-system/as-button';
import { AsChip } from '@/components/design-system/as-chip';
import { AsField } from '@/components/design-system/as-field';
import { LocationPicker } from '@/components/location-picker';
import { DSColors, DSSpacing, DSText } from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { useUserLocation } from '@/hooks/use-user-location';
import { ApiError, createEvent, type Visibility } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';

const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

/** Accepts "DD/MM/AAAA" and "HH:MM" and returns an ISO datetime, or null if invalid. */
function parseDateTime(dateText: string, timeText: string): string | null {
  const dateMatch = dateText.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const timeMatch = timeText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const [, day, month, year] = dateMatch;
  const [, hour, minute] = timeMatch;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function CreateEventScreen() {
  const { accessToken } = useAuth();
  const { region } = useUserLocation();

  const [sport, setSport] = useState<SportKey>('futebol');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('20');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Starts out following the user's real location, then becomes independent
  // once they drag the pin — the picker is the source of truth after that.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinMoved, setPinMoved] = useState(false);

  if (region && !coords && !pinMoved) {
    setCoords({ latitude: region.latitude, longitude: region.longitude });
  }

  const [titleError, setTitleError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [dateTimeError, setDateTimeError] = useState('');
  const [maxError, setMaxError] = useState('');

  async function handleSubmit() {
    const nextTitleError = title.trim().length >= 3 ? '' : 'Dê um nome pro evento';
    const nextLocationError = location.trim().length >= 3 ? '' : 'Informe o local';
    const startsAt = parseDateTime(date, time);
    const nextDateTimeError = startsAt ? '' : 'Use o formato DD/MM/AAAA e HH:MM';
    const maxNumber = Number(maxParticipants);
    const nextMaxError =
      Number.isInteger(maxNumber) && maxNumber > 0 ? '' : 'Informe um número de vagas válido';

    setTitleError(nextTitleError);
    setLocationError(nextLocationError);
    setDateTimeError(nextDateTimeError);
    setMaxError(nextMaxError);
    setFormError('');
    if (nextTitleError || nextLocationError || nextDateTimeError || nextMaxError || !startsAt)
      return;

    if (!accessToken) return;
    if (!coords) {
      setFormError('Precisamos da sua localização para registrar onde o evento acontece.');
      return;
    }

    setLoading(true);
    try {
      await createEvent(accessToken, {
        sport,
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        starts_at: startsAt,
        max_participants: maxNumber,
        visibility,
      });
      router.replace('/main/events');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Erro ao criar o evento');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Voltar">
            <Text style={styles.backLabel}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Criar evento</Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {formError ? (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Esporte</Text>
              <View style={styles.chips}>
                {SPORT_KEYS.map((key) => (
                  <AsChip
                    key={key}
                    label={SPORT_TYPES[key].label}
                    dotColor={SPORT_TYPES[key].color}
                    active={sport === key}
                    onPress={() => setSport(key)}
                  />
                ))}
              </View>
            </View>

            <AsField
              label="Título"
              placeholder="Pelada de quinta"
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                if (titleError) setTitleError('');
              }}
              error={titleError}
            />
            <AsField
              label="Descrição (opcional)"
              placeholder="Nível, regras, o que levar..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={styles.multilineInput}
            />
            <AsField
              label="Local"
              placeholder="Arena Leste, Quadra 2"
              value={location}
              onChangeText={(v) => {
                setLocation(v);
                if (locationError) setLocationError('');
              }}
              error={locationError}
            />

            {coords && (
              <LocationPicker
                latitude={coords.latitude}
                longitude={coords.longitude}
                onChange={(latitude, longitude) => {
                  setPinMoved(true);
                  setCoords({ latitude, longitude });
                }}
              />
            )}

            <View style={styles.row}>
              <View style={styles.rowField}>
                <AsField
                  label="Data"
                  placeholder="DD/MM/AAAA"
                  value={date}
                  onChangeText={(v) => {
                    setDate(v);
                    if (dateTimeError) setDateTimeError('');
                  }}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.rowField}>
                <AsField
                  label="Hora"
                  placeholder="HH:MM"
                  value={time}
                  onChangeText={(v) => {
                    setTime(v);
                    if (dateTimeError) setDateTimeError('');
                  }}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {dateTimeError ? <Text style={styles.errorText}>{dateTimeError}</Text> : null}

            <AsField
              label="Vagas"
              placeholder="20"
              value={maxParticipants}
              onChangeText={(v) => {
                setMaxParticipants(v.replace(/\D/g, ''));
                if (maxError) setMaxError('');
              }}
              keyboardType="number-pad"
              error={maxError}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Visibilidade</Text>
              <View style={styles.segment}>
                <Pressable
                  style={[styles.segmentBtn, visibility === 'public' && styles.segmentBtnActive]}
                  onPress={() => setVisibility('public')}>
                  <Text
                    style={[
                      styles.segmentLabel,
                      visibility === 'public' && styles.segmentLabelActive,
                    ]}>
                    Público
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentBtn, visibility === 'private' && styles.segmentBtnActive]}
                  onPress={() => setVisibility('private')}>
                  <Text
                    style={[
                      styles.segmentLabel,
                      visibility === 'private' && styles.segmentLabelActive,
                    ]}>
                    Privado
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.help}>
                {visibility === 'public'
                  ? 'Qualquer pessoa pode encontrar e participar.'
                  : 'Só aparece pra quem você convidar por link direto.'}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView edges={['bottom']} style={styles.dock}>
          <AsButton
            label={loading ? 'Criando...' : 'Criar evento'}
            variant="primary"
            block
            loading={loading}
            onPress={handleSubmit}
          />
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DSColors.surface },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DSSpacing[2],
    minHeight: 56,
    paddingHorizontal: DSSpacing[2],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  backLabel: { fontSize: 24, fontWeight: '800', color: DSColors.ink },
  headerTitle: {
    fontSize: DSText.xl,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: DSColors.ink,
  },
  content: { gap: 14, padding: DSSpacing[4], paddingBottom: DSSpacing[6] },
  field: { gap: 6 },
  label: { fontSize: DSText.sm, fontWeight: '800', color: DSColors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  multilineInput: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },
  errorText: { fontSize: DSText.xs, fontWeight: '700', color: DSColors.danger, marginTop: -8 },
  segment: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: DSColors.surface2,
    borderRadius: 10,
  },
  segmentBtn: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: { backgroundColor: DSColors.surface },
  segmentLabel: { fontSize: DSText.sm, fontWeight: '800', color: DSColors.inkSecondary },
  segmentLabelActive: { color: DSColors.ink },
  help: { fontSize: DSText.xs, fontWeight: '600', color: DSColors.inkSecondary },
  formError: { padding: 12, borderRadius: 8, backgroundColor: DSColors.dangerTint },
  formErrorText: {
    fontSize: DSText.sm,
    fontWeight: '700',
    color: DSColors.danger,
    textAlign: 'center',
  },
  dock: {
    paddingHorizontal: DSSpacing[4],
    paddingTop: DSSpacing[3],
    borderTopWidth: 1,
    borderTopColor: DSColors.line,
    backgroundColor: DSColors.surface,
  },
});
