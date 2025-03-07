(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });

         var medication = smart.patient.api.fetchAll({
          type: 'MedicationOrder'
        });

        $.when(pt, obv, medication).fail(onError);

        $.when(pt, obv, medication).done(function(patient, obv, medication) {
          console.log('Patient data:', patient);
          console.log('Observation data:', obv);
          console.log('Medication data:', medication);
          displayMedicationList(medication);
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

        var medications = medication.map(function(med) {
            return med.medicationCodeableConcept.text;
            return med.resource.medicationCodeableConcept && med.resource.medicationCodeableConcept.text ? med.resource.medicationCodeableConcept.text : 'Unknown Medication';
          });
          
          console.log('Medications:', medications);
          p.medications = medications.join('<br>');
          // p.medications = displayMedicationList(medication);
          console.log('Final patient data:', p);
          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

function displayMedicationList(medications) {
  // Clear any existing medication list
  $('#medicationList').empty();

  // Iterate over each medication and add it to the list
  medications.forEach(function(medication) {
    var medicationHtml = '<li>';

    // Extract medication details
    var medicationName = 'Unknown Medication';
    var status = 'Unknown';
    var prescriberName = 'Unknown';
    var note = '';
    var dateWritten = 'Unknown';
    var validityPeriodStart = 'Unknown';
    var dosageInstructions = 'Unknown Dosage Instructions';

    if (medication && medication.resource && medication.resource.medicationCodeableConcept && medication.resource.medicationCodeableConcept.text) {
      medicationName = medication.resource.medicationCodeableConcept.text;
    }

    if (medication && medication.resource && medication.resource.status) {
      status = medication.resource.status;
    }

    if (medication && medication.resource && medication.resource.prescriber && medication.resource.prescriber.display) {
      prescriberName = medication.resource.prescriber.display;
    }

    if (medication && medication.resource && medication.resource.note) {
      note = medication.resource.note;
    }

    if (medication && medication.resource && medication.resource.dateWritten) {
      dateWritten = new Date(medication.resource.dateWritten).toLocaleString();
    }

    if (medication && medication.resource && medication.resource.dispenseRequest && medication.resource.dispenseRequest.validityPeriod && medication.resource.dispenseRequest.validityPeriod.start) {
      validityPeriodStart = new Date(medication.resource.dispenseRequest.validityPeriod.start).toLocaleString();
    }

    if (medication && medication.resource && medication.resource.dosageInstruction && medication.resource.dosageInstruction[0] && medication.resource.dosageInstruction[0].text) {
      dosageInstructions = medication.resource.dosageInstruction[0].text;
    }

    // Construct medication HTML
    medicationHtml += '<b>Medication Name:</b> ' + medicationName + '<br>' +
                      '<b>Status:</b> ' + status + '<br>' +
                      '<b>Patient Name:</b> ' + (medication.resource && medication.resource.patient && medication.resource.patient.display ? medication.resource.patient.display : 'Unknown') + '<br>' +
                      '<b>Prescriber:</b> ' + prescriberName + '<br>' +
                      '<b>Note:</b> ' + note + '<br>' +
                      '<b>Date Written:</b> ' + dateWritten + '<br>' +
                      '<b>Validity Period:</b> ' + validityPeriodStart + '<br>' +
                      '<b>Dosage Instructions:</b> ' + dosageInstructions + '<br>';

    // Close the list item tag
    medicationHtml += '</li>';

    // Append the medication HTML to the medicationList
    $('#medicationList').append(medicationHtml);
  });
}





  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
      medications: {value: ''}
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
    $('#medicationList').html(p.medications);
  };

})(window);
