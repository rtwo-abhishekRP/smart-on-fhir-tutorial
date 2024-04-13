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

          //Medications
          var medications = medication.map(function(med) {
            return med.medicationCodeableConcept.text;
          });
          console.log('Medications:', medications);
          p.medications = medications.join('<br>');
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

  function formatMedication(med) {
    var medicationName = med.medicationCodeableConcept.text;
    var dosageInstruction = med.dosageInstruction[0].text;
    var status = med.status;
    var patientName = med.text.div.match(/<b>Patient Name<\/b>: (.*?)<\/p>/)[1];
    var prescriber = med.prescriber.display;
    var note = med.note;
    var dateWritten = new Date(med.dateWritten).toLocaleString();
    var validityPeriod = new Date(med.dispenseRequest.validityPeriod.start).toLocaleDateString();
    
    // Constructing medication HTML string
    var medicationHtml = '<b>Medication Name:</b> ' + medicationName + '<br>' +
                         '<b>Dosage Instructions:</b> ' + dosageInstruction + '<br>' +
                         '<b>Status:</b> ' + status + '<br>' +
                         '<b>Patient Name:</b> ' + patientName + '<br>' +
                         '<b>Prescriber:</b> ' + prescriber + '<br>' +
                         '<b>Note:</b> ' + note + '<br>' +
                         '<b>Date Written:</b> ' + dateWritten + '<br>' +
                         '<b>Validity Period:</b> ' + validityPeriod;

    $('#medicationList').append(medicationHtml);    
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
