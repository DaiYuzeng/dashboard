<script>
import CruResource from '@/components/CruResource';
import createEditView from '@/mixins/create-edit-view';
import LabeledInput from '@/components/form/LabeledInput';
import UnitInput from '@/components/form/UnitInput';
import LabeledSelect from '@/components/form/LabeledSelect';
import Banner from '@/components/Banner';
import RadioGroup from '@/components/form/RadioGroup';
import NameNsDescription from '@/components/form/NameNsDescription';
import Loading from '@/components/Loading';
import S3 from '@/chart/rancher-backup/S3';
import { mapGetters } from 'vuex';
import { SECRET, BACKUP_RESTORE, CATALOG } from '@/config/types';
import { allHash } from '@/utils/promise';
import { NAMESPACE, _VIEW } from '@/config/query-params';
import { sortBy } from '@/utils/sort';
import { get } from '@/utils/object';
export default {

  components: {
    CruResource,
    UnitInput,
    LabeledInput,
    LabeledSelect,
    RadioGroup,
    NameNsDescription,
    Banner,
    Loading,
    S3,
  },
  mixins: [createEditView],

  props: {
    value: {
      type:    Object,
      default: () => {
        return {};
      }
    },
    mode: {
      type:    String,
      default: 'create'
    }
  },

  async fetch() {
    await this.$store.dispatch('catalog/load');

    const hash = await allHash({
      secrets:      this.$store.dispatch('cluster/findAll', { type: SECRET }),
      resourceSet: this.$store.dispatch('cluster/find', { type: BACKUP_RESTORE.RESOURCE_SET, id: this.value?.spec?.resourceSetName || 'rancher-resource-set' }),
      apps:         this.$store.dispatch('cluster/findAll', { type: CATALOG.APP })

    });

    this.allSecrets = hash.secrets;
    this.resourceSet = hash.resourceSet;
    this.apps = hash.apps;
  },

  data() {
    if (!this.value.spec) {
      this.$set(this.value, 'spec', { retentionCount: 10 });
    }
    let s3 = {};
    let useEncryption = false;
    let setSchedule = false;
    let storageSource = 'useDefault';

    if (this.value.spec.encryptionConfigSecretName) {
      useEncryption = true;
    }

    if (this.value.spec.schedule) {
      setSchedule = true;
    }

    if (this.value?.spec?.storageLocation?.s3) {
      storageSource = 'configureS3';
      s3 = this.value.spec.storageLocation.s3;
    }

    return {
      allSecrets: [], resourceSet: null, s3, storageSource, useEncryption, apps: [], setSchedule, name: this.value?.metadata?.name,
    };
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },

    chartNamespace() {
      const BRORelease = this.apps.filter(release => get(release, 'spec.name') === 'rancher-backup')[0];

      return BRORelease ? BRORelease.spec.namespace : '';
    },

    encryptionSecretNames() {
      return this.allSecrets.filter(secret => (secret.data || {})['encryption-provider-config.yaml'] && secret.metadata.namespace === this.chartNamespace && !secret.metadata?.state?.error).map(secret => secret.metadata.name);
    },

    storageOptions() {
      const options = ['useDefault', 'configureS3'];
      const labels = [this.t('backupRestoreOperator.storageSource.useDefault'), this.t('backupRestoreOperator.storageSource.configureS3')];

      return { options, labels };
    },

    encryptionOptions() {
      const options = [false, true];
      const labels = [this.t('backupRestoreOperator.encryptionConfigName.options.none'), this.t('backupRestoreOperator.encryptionConfigName.options.secret', {}, true)];

      return { options, labels };
    },

    namespaces() {
      const choices = this.$store.getters['cluster/all'](NAMESPACE);
      const out = sortBy(choices.map((obj) => {
        return {
          label: obj.nameDisplay,
          value: obj.id,
        };
      }), 'label');

      return out;
    },

    validated() {
      return !!this.name && (!this.useEncryption || !!this.value?.spec?.encryptionConfigSecretName);
    },

    ...mapGetters({ t: 'i18n/t' })
  },

  watch: {
    storageSource(neu) {
      if (neu === 'useDefault') {
        delete this.value.spec.storageLocation;
      } else {
        this.$set(this.value.spec, 'storageLocation', { s3: this.s3 });
      }
    },

    resourceSet(neu) {
      if (neu?.metadata?.name) {
        this.$set(this.value.spec, 'resourceSetName', neu?.metadata?.name);
      }
    },

    setSchedule(neu) {
      if (!neu) {
        delete this.value.spec.schedule;
        delete this.value.spec.retentionCount;
      }
    },

    useEncryption(neu) {
      if (!neu) {
        this.value.spec.encryptionConfigSecretName = '';
      }
    }
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <CruResource :validation-passed="validated" :done-route="doneRoute" :resource="value" :mode="mode" @finish="save">
      <template>
        <NameNsDescription :mode="mode" :value="value" :namespaced="false" @change="name=value.metadata.name" />
        <template v-if="!!resourceSet">
          <div v-if="!isView || setSchedule" class="bordered-section">
            <RadioGroup
              v-if="!isView"
              v-model="setSchedule"
              :mode="mode"
              :label="t('backupRestoreOperator.schedule.label')"
              name="setSchedule"
              :options="[false, true]"
              :labels="[t('backupRestoreOperator.schedule.options.disabled'), t('backupRestoreOperator.schedule.options.enabled')]"
            />
            <div v-if="setSchedule" class="row mt-10 mb-10">
              <div class="col span-6">
                <LabeledInput v-model="value.spec.schedule" :mode="mode" :label="t('backupRestoreOperator.schedule.label')" :placeholder="t('backupRestoreOperator.schedule.placeholder')" />
              </div>
              <div class="col span-6">
                <UnitInput v-model="value.spec.retentionCount" :suffix="t('backupRestoreOperator.retentionCount.units', {count: value.spec.retentionCount || 0})" :mode="mode" :label="t('backupRestoreOperator.retentionCount.label')" />
              </div>
            </div>
          </div>

          <div v-if="!isView || useEncryption" class="bordered-section">
            <div class="row">
              <div class="col span-12">
                <RadioGroup
                  v-if="!isView"
                  v-model="useEncryption"
                  name="useEncryption"
                  :label="t('backupRestoreOperator.encryption')"
                  :options="encryptionOptions.options"
                  :labels="encryptionOptions.labels"
                  :mode="mode"
                />
              </div>
            </div>
            <div v-if="useEncryption" :style="{'align-items':'center'}" class="row mt-10">
              <div class="col span-6">
                <LabeledSelect
                  v-model="value.spec.encryptionConfigSecretName"
                  :tooltip="t('backupRestoreOperator.encryptionConfigName.backuptip', {}, true)"
                  :hover-tooltip="true"
                  :mode="mode"
                  :options="encryptionSecretNames"
                  :label="t('backupRestoreOperator.encryptionConfigName.label')"
                />
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col span-12">
              <span v-if="isView" class="text-label">{{ t('backupRestoreOperator.s3.titles.location') }}</span>
              <RadioGroup
                v-else
                v-model="storageSource"
                name="storageSource"
                :label="t('backupRestoreOperator.s3.titles.location')"
                :options="storageOptions.options"
                :labels="storageOptions.labels"
                :mode="mode"
              />
            </div>
          </div>

          <template v-if="storageSource !== 'useDefault'">
            <div class="row mt-10">
              <div class="col span-12">
                <S3 :value="s3" :secrets="allSecrets" :mode="mode" />
              </div>
            </div>
          </template>
          <template v-else-if="isView">
            <span>{{ t('generic.default') }}</span>
          </template>
        </template>
        <Banner v-else color="error">
          <span v-html="t('backupRestoreOperator.noResourceSet')" />
        </Banner>
      </template>
    </CruResource>
  </div>
</template>
