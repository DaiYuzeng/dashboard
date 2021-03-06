<script>
import { _VIEW } from '@/config/query-params';
import { get, isEmpty, clone } from '@/utils/object';
import { NODE } from '@/config/types';
import MatchExpressions from '@/components/form/MatchExpressions';
import InfoBox from '@/components/InfoBox';
import LabeledSelect from '@/components/form/LabeledSelect';
import { randomStr } from '@/utils/string';

export default {
  components: {
    MatchExpressions, InfoBox, LabeledSelect
  },

  props:      {
    // value should be NodeAffinity or VolumeNodeAffinity
    value: {
      type:    Object,
      default: () => {
        return {};
      }
    },

    mode: {
      type:    String,
      default: 'create'
    },
  },

  data() {
    // VolumeNodeAffinity only has 'required' field
    if (this.value.required) {
      return { nodeSelectorTerms: this.value.required.nodeSelectorTerms };
    } else {
      const { preferredDuringSchedulingIgnoredDuringExecution = [], requiredDuringSchedulingIgnoredDuringExecution = {} } = this.value;
      const { nodeSelectorTerms = [] } = requiredDuringSchedulingIgnoredDuringExecution;
      const allSelectorTerms = [...preferredDuringSchedulingIgnoredDuringExecution, ...nodeSelectorTerms].map((term) => {
        const neu = clone(term);

        neu._id = randomStr(4);
        if (term.preference) {
          Object.assign(neu, term.preference);
          delete neu.preference;
        }

        return neu;
      });

      return {
        allSelectorTerms,
        weightedNodeSelectorTerms: preferredDuringSchedulingIgnoredDuringExecution,
        defaultWeight:             1
      };
    }
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },
    hasWeighted() {
      return !!this.weightedNodeSelectorTerms;
    },
    node() {
      return NODE;
    },
  },

  methods: {
    update() {
      this.$nextTick(() => {
        const out = {};
        const requiredDuringSchedulingIgnoredDuringExecution = { nodeSelectorTerms: [] };
        const preferredDuringSchedulingIgnoredDuringExecution = [] ;

        this.allSelectorTerms.forEach((term) => {
          if (term.weight) {
            const neu = { weight: 1, preference: term };

            preferredDuringSchedulingIgnoredDuringExecution.push(neu);
          } else {
            requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms.push(term);
          }
        });

        if (preferredDuringSchedulingIgnoredDuringExecution.length) {
          out.preferredDuringSchedulingIgnoredDuringExecution = preferredDuringSchedulingIgnoredDuringExecution;
        }
        if (requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms.length) {
          out.requiredDuringSchedulingIgnoredDuringExecution = requiredDuringSchedulingIgnoredDuringExecution;
        }
        this.$emit('input', out);
      });
    },

    changePriority(term) {
      if (term.weight) {
        this.$delete(term, 'weight');
      } else {
        this.$set(term, 'weight', 1);
      }
    },

    priorityDisplay(term) {
      return term.weight ? this.t('workload.scheduling.affinity.preferred') : this.t('workload.scheduling.affinity.required');
    },

    get,

    isEmpty
  }

};
</script>

<template>
  <div class="row" @input="update">
    <div class="col span-12">
      <template v-for="(nodeSelectorTerm, idx) in allSelectorTerms">
        <InfoBox :key="nodeSelectorTerm._id" class="node-selector mt-20">
          <div class="row">
            <div class="col span-6">
              <LabeledSelect
                :options="[t('workload.scheduling.affinity.preferred'),t('workload.scheduling.affinity.required')]"
                :value="priorityDisplay(nodeSelectorTerm)"
                :label="t('workload.scheduling.affinity.priority')"
                :mode="mode"
                @input="(changePriority(nodeSelectorTerm))"
              />
            </div>
          </div>
          <MatchExpressions
            v-model="nodeSelectorTerm.matchExpressions"
            :initial-empty-row="!isView"
            :mode="mode"
            class="col span-12"
            :type="node"
            @remove="allSelectorTerms.splice(idx,1)"
          />
        </InfoBox>
      </template>
      <button v-if="!isView" type="button" class="btn role-tertiary" @click="e=>allSelectorTerms.push({matchExpressions:[]})">
        <t k="workload.scheduling.affinity.addNodeSelector" />
      </button>
    </div>
  </div>
</template>

<style>
  .node-selector{
    position: relative;
  }
</style>
