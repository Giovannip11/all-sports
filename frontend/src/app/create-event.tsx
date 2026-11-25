import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsChip } from '@/components/design-system/as-chip';
import { AsField } from '@/components/design-system/as-field';
import { AsHeader } from '@/components/design-system/as-header';
import { AsColumn } from '@/components/design-system/as-layout';
import { AsSegmented } from '@/components/design-system/as-segmented';
import { LocationPicker } from '@/components/location-picker';
import { DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { useUserLocation } from '@/hooks/use-user-location';
import {
  ApiError,
  createEvent,
  createTournament,
  getEvent,
  updateEvent,
  type Visibility,
} from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { formatDate, formatTime } from '@/utils/masks';

const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

/** Centro de São Paulo — só usado quando a localização do aparelho não está disponível. */
const FALLBACK_COORDS = { latitude: -23.5505, longitude: -46.6333 };

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
  // new Date() "corrige" datas impossíveis (31/02 vira 03/03, 25:00 vira o dia
  // seguinte); aqui elas são recusadas.
  if (
    date.getDate() !== Number(day) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getFullYear() !== Number(year) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    return null;
  }
  return date.toISOString();
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Criar evento e, com `?eventId=`, editar um existente (EVENT-06): o mesmo
 * formulário, preenchido com os dados atuais. O esporte não muda na edição
 * (a API não aceita) — para isso, crie outro evento.
 */
export default function CreateEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const editing = !!eventId;
  const { accessToken } = useAuth();
  const { region, status: locationStatus } = useUserLocation();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loadingEvent, setLoadingEvent] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [originalStart, setOriginalStart] = useState<string | null>(null);

  const [sport, setSport] = useState<SportKey>('futebol');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('20');
  const [visibility, setVisibility] = useState<Visibility>('public');
  // TOUR-01: o mesmo formulário cria um torneio (mata-mata entre equipes).
  const [kind, setKind] = useState<'pickup' | 'tournament'>('pickup');
  const [maxTeams, setMaxTeams] = useState('8');
  const [playersMin, setPlayersMin] = useState('5');
  const [playersMax, setPlayersMax] = useState('7');
  const [prize, setPrize] = useState('');
  const [teamsError, setTeamsError] = useState('');
  const isTournament = !editing && kind === 'tournament';
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Starts out following the user's real location, then becomes independent
  // once they drag the pin — the picker is the source of truth after that.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  // Na edição o ponto já é o do evento: a localização do aparelho não o substitui.
  const [pinMoved, setPinMoved] = useState(editing);

  useEffect(() => {
    if (!editing || !accessToken || !eventId) return;
    let cancelled = false;
    getEvent(accessToken, eventId)
      .then((event) => {
        if (cancelled) return;
        const start = new Date(event.starts_at);
        if (event.sport in SPORT_TYPES) setSport(event.sport as SportKey);
        setTitle(event.title);
        setDescription(event.description ?? '');
        setLocation(event.location);
        setOriginalStart(start.toISOString());
        setDate(`${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()}`);
        setTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
        setMaxParticipants(String(event.max_participants));
        setVisibility(event.visibility);
        setCoords({ latitude: event.latitude, longitude: event.longitude });
        if (!event.is_organizer) setLoadError('Só o organizador pode editar este evento.');
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o evento');
      })
      .finally(() => {
        if (!cancelled) setLoadingEvent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, accessToken, eventId]);

  // Acompanha as leituras mais precisas que chegam depois, até a pessoa mexer no pino.
  if (
    region &&
    !pinMoved &&
    (coords?.latitude !== region.latitude || coords?.longitude !== region.longitude)
  ) {
    setCoords({ latitude: region.latitude, longitude: region.longitude });
  }
  // Sem permissão de localização o botão "Criar evento" ficava sempre bloqueado.
  // Agora o mapa abre num ponto padrão e a pessoa arrasta o pino até o local.
  const locationUnavailable = locationStatus === 'denied' || locationStatus === 'error';
  if (locationUnavailable && !coords && !editing) {
    setCoords(FALLBACK_COORDS);
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
      isTournament || (Number.isInteger(maxNumber) && maxNumber > 0)
        ? ''
        : 'Informe um número de vagas válido';
    const teamsNumber = Number(maxTeams);
    const minPlayers = Number(playersMin);
    const maxPlayers = Number(playersMax);
    const nextTeamsError = !isTournament
      ? ''
      : !Number.isInteger(teamsNumber) || teamsNumber < 2
        ? 'O torneio precisa de pelo menos 2 equipes'
        : !Number.isInteger(minPlayers) || minPlayers < 1 || !Number.isInteger(maxPlayers)
          ? 'Informe quantos jogadores cada equipe pode ter'
          : maxPlayers < minPlayers
            ? 'O máximo de jogadores não pode ser menor que o mínimo'
            : '';

    setTitleError(nextTitleError);
    setLocationError(nextLocationError);
    setDateTimeError(nextDateTimeError);
    setMaxError(nextMaxError);
    setTeamsError(nextTeamsError);
    setFormError('');
    if (
      nextTitleError ||
      nextLocationError ||
      nextDateTimeError ||
      nextMaxError ||
      nextTeamsError ||
      !startsAt
    )
      return;

    if (!accessToken) return;
    if (!coords) {
      setFormError('Precisamos da sua localização para registrar onde o evento acontece.');
      return;
    }

    setLoading(true);
    try {
      if (editing && eventId) {
        await updateEvent(accessToken, eventId, {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          // Só manda a data se ela mudou: reenviar a mesma de um evento que já
          // começou faria o banco recusar ("data no passado").
          ...(startsAt !== originalStart ? { starts_at: startsAt } : {}),
          max_participants: maxNumber,
          visibility,
        });
        // O detalhe recarrega ao voltar (useFocusEffect); inscritos são avisados pelo backend.
        if (router.canGoBack()) router.back();
        else router.replace(`/event/${eventId}`);
        return;
      }
      if (isTournament) {
        const created = await createTournament(accessToken, {
          sport,
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          starts_at: startsAt,
          max_teams: teamsNumber,
          players_per_team_min: minPlayers,
          players_per_team_max: maxPlayers,
          prize_description: prize.trim() || undefined,
          visibility,
        });
        router.replace(`/tournament/${created.id}`);
        return;
      }
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
      setFormError(
        error instanceof ApiError
          ? error.message
          : editing
            ? 'Erro ao salvar o evento'
            : 'Erro ao criar o evento',
      );
    } finally {
      setLoading(false);
    }
  }

  const hasFieldErrors = !!(titleError || locationError || dateTimeError || maxError || teamsError);

  if (editing && (loadingEvent || loadError)) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.flex} edges={['top']}>
          <AsHeader title="Editar evento" bordered />
          <View style={styles.centered}>
            {loadingEvent ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <AsBanner tone="error" message={loadError} />
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <AsHeader title={editing ? 'Editar evento' : 'Criar evento'} bordered />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <AsColumn width="form" style={styles.column}>
              {!editing && (
                <View style={styles.field}>
                  <Text style={styles.label}>Tipo</Text>
                  <AsSegmented
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: 'pickup', label: 'Racha' },
                      { value: 'tournament', label: 'Torneio' },
                    ]}
                  />
                  <Text style={styles.help}>
                    {kind === 'tournament'
                      ? 'Campeonato em mata-mata entre equipes. Exige o plano Intermediário ou Arena.'
                      : 'Partida avulsa: cada pessoa se inscreve na vaga.'}
                  </Text>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Esporte</Text>
                {editing ? (
                  <>
                    <View style={styles.chips}>
                      <AsChip
                        label={SPORT_TYPES[sport].label}
                        dotColor={SPORT_TYPES[sport].color}
                        active
                      />
                    </View>
                    <Text style={styles.help}>
                      O esporte não muda depois de criado. Para outro esporte, crie um novo evento.
                    </Text>
                  </>
                ) : (
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
                )}
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

              {locationUnavailable && !pinMoved && (
                <AsBanner
                  tone="warning"
                  message="Não conseguimos sua localização. Arraste o pino até o local do evento."
                />
              )}
              {coords ? (
                <LocationPicker
                  latitude={coords.latitude}
                  longitude={coords.longitude}
                  onChange={(latitude, longitude) => {
                    setPinMoved(true);
                    setCoords({ latitude, longitude });
                  }}
                />
              ) : (
                <AsBanner
                  tone="info"
                  message="Aguardando sua localização para mostrar o mapa do local."
                />
              )}

              <View style={styles.field}>
                <View style={styles.row}>
                  <View style={styles.rowField}>
                    <AsField
                      label="Data"
                      placeholder="DD/MM/AAAA"
                      value={date}
                      onChangeText={(v) => {
                        setDate(formatDate(v));
                        if (dateTimeError) setDateTimeError('');
                      }}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={styles.rowFieldSmall}>
                    <AsField
                      label="Hora"
                      placeholder="HH:MM"
                      value={time}
                      onChangeText={(v) => {
                        setTime(formatTime(v));
                        if (dateTimeError) setDateTimeError('');
                      }}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
                {dateTimeError ? (
                  <Text style={styles.errorText} accessibilityLiveRegion="polite">
                    {dateTimeError}
                  </Text>
                ) : null}
              </View>

              {isTournament ? (
                <View style={styles.field}>
                  <AsField
                    label="Máximo de equipes"
                    placeholder="8"
                    helpText="O chaveamento é mata-mata; com 4, 8, 16 ou 32 equipes ninguém passa direto."
                    value={maxTeams}
                    onChangeText={(v) => {
                      setMaxTeams(v.replace(/\D/g, '').slice(0, 3));
                      setTeamsError('');
                    }}
                    keyboardType="number-pad"
                  />
                  <View style={styles.row}>
                    <View style={styles.rowField}>
                      <AsField
                        label="Jogadores por equipe (mín.)"
                        value={playersMin}
                        onChangeText={(v) => {
                          setPlayersMin(v.replace(/\D/g, '').slice(0, 2));
                          setTeamsError('');
                        }}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.rowField}>
                      <AsField
                        label="(máx.)"
                        value={playersMax}
                        onChangeText={(v) => {
                          setPlayersMax(v.replace(/\D/g, '').slice(0, 2));
                          setTeamsError('');
                        }}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  {teamsError ? (
                    <Text style={styles.errorText} accessibilityLiveRegion="polite">
                      {teamsError}
                    </Text>
                  ) : null}
                  <AsField
                    label="Premiação (opcional)"
                    placeholder="Troféu + medalhas para o campeão"
                    value={prize}
                    maxLength={500}
                    onChangeText={setPrize}
                  />
                </View>
              ) : (
                <AsField
                  label="Vagas"
                  placeholder="20"
                  helpText="Total de pessoas, incluindo você."
                  value={maxParticipants}
                  onChangeText={(v) => {
                    setMaxParticipants(v.replace(/\D/g, ''));
                    if (maxError) setMaxError('');
                  }}
                  keyboardType="number-pad"
                  error={maxError}
                />
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Visibilidade</Text>
                <AsSegmented
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                    { value: 'public', label: 'Público', accessibilityLabel: 'Visibilidade pública' },
                    { value: 'private', label: 'Privado', accessibilityLabel: 'Visibilidade privada' },
                  ]}
                />
                <Text style={styles.help}>
                  {visibility === 'public'
                    ? 'Qualquer pessoa pode encontrar e participar.'
                    : 'Só aparece pra quem você convidar por link direto.'}
                </Text>
              </View>
            </AsColumn>
          </ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView edges={['bottom']} style={styles.dock}>
          <AsColumn width="form" style={styles.dockColumn}>
            {formError ? (
              <AsBanner tone="error" message={formError} />
            ) : hasFieldErrors ? (
              <AsBanner tone="error" message="Revise os campos marcados em vermelho." />
            ) : null}
            <AsButton
              label={
                editing
                  ? loading
                    ? 'Salvando...'
                    : 'Salvar alterações'
                  : loading
                    ? 'Criando...'
                    : isTournament
                      ? 'Criar torneio'
                      : 'Criar evento'
              }
              variant="primary"
              block
              loading={loading}
              onPress={handleSubmit}
            />
          </AsColumn>
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: DSColors.surface },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: DSSpacing[4] },
    flex: { flex: 1 },
    content: { padding: DSSpacing[4], paddingBottom: DSSpacing[6] },
    column: { gap: DSSpacing[5] },
    field: { gap: DSSpacing[2] },
    label: { ...DSType.label, color: DSColors.ink },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: DSSpacing[2] },
    multilineInput: { height: 88, paddingTop: DSSpacing[3], textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: DSSpacing[3] },
    rowField: { flex: 3 },
    rowFieldSmall: { flex: 2 },
    errorText: { ...DSType.meta, fontWeight: '700', color: DSColors.danger },
    help: { ...DSType.meta, color: DSColors.inkSecondary },
    dock: {
      paddingHorizontal: DSSpacing[4],
      paddingTop: DSSpacing[3],
      paddingBottom: DSSpacing[3],
      borderTopWidth: 1,
      borderTopColor: DSColors.line,
      backgroundColor: DSColors.surface,
    },
    dockColumn: { gap: DSSpacing[2] },
  });
}
