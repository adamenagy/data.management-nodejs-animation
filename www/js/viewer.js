var MyVars = {
  keepTrying: true
};

function GetURLParameter(sParam) {
  var sPageURL = window.location.search.substring(1);
  var sURLVariables = sPageURL.split('&');
  for (var i = 0; i < sURLVariables.length; i++) {
    var sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] == sParam) {
      return sParameterName[1];
    }
  }
}

$(document).ready(function () {
  // Get the tokens
  get3LegToken(function (token) {

    if (!token) {
      signIn();
    } else {
      MyVars.token3Leg = token;

      MyVars.urn = GetURLParameter('urn');
      initializeViewer(MyVars.urn);
    }
  });

  $('#storyboardsButton').click(toggleStoryboardsList);
});

function toggleStoryboardsList() {
  $('#storyboardsList').toggle();
}

function signIn() {
  $.ajax({
    url: '/user/authenticate',
    success: function (rootUrl) {
      location.href = rootUrl;
    }
  });
}

function get3LegToken(callback) {

  if (callback) {
    $.ajax({
      url: '/user/token',
      success: function (data) {
        MyVars.token3Leg = data.token;
        console.log('Returning new 3 legged token (User Authorization): ' + MyVars.token3Leg);
        callback(data.token, data.expires_in);
      }
    });
  } else {
    console.log('Returning saved 3 legged token (User Authorization): ' + MyVars.token3Leg);

    return MyVars.token3Leg;
  }
}

/////////////////////////////////////////////////////////////////
// Viewer
// Based on Autodesk Viewer basic sample
// https://developer.autodesk.com/api/viewerapi/
/////////////////////////////////////////////////////////////////

function clearViewer() {
  // Clear the viewer content
  if (MyVars.viewer && MyVars.viewer.model) {
    console.log("Unloading current model from Autodesk Viewer");

    //MyVars.viewer.impl.unloadModel(MyVars.viewer.model);
    //MyVars.viewer.impl.sceneUpdated(true);
    MyVars.viewer.tearDown();
    MyVars.viewer.setUp(MyVars.viewer.config);
  }
}

function showProperties(dbId) {
  if (dbId) {
    MyVars.viewer.getProperties(dbId, function (event) {
      var propertiesHtml = '<table>';
      for (var id in event.properties) {
        var prop = event.properties[id];
        if (prop.hidden)
          continue;

        propertiesHtml += '<tr><td>' + prop.displayName + '</td><td>' +
          prop.displayValue + '</td></tr>';
      }
      propertiesHtml += '</table>';

      $('#properties').html(propertiesHtml);
    })
  } else {
    $('#properties').html('');
  }

}

function initializeViewer(urn, path) {
  clearViewer();

  console.log("Launching Autodesk Viewer for: " + urn);

  var options = {
    document: 'urn:' + urn,
    env: 'AutodeskProduction',
    getAccessToken: get3LegToken
  };

  if (MyVars.viewer) {
    loadDocument(MyVars.viewer, options.document, path);
  } else {
    var viewerElement = document.getElementById('forgeViewer');
    var config = {
      extensions: ['Autodesk.Fusion360.Animation']
    };
    MyVars.viewer = new Autodesk.Viewing.Private.GuiViewer3D(viewerElement, config);
    Autodesk.Viewing.Initializer(
      options,
      function () {
        MyVars.viewer.start(); // this would be needed if we also want to load extensions
        loadDocument(MyVars.viewer, options.document, path);
        MyVars.viewer.addEventListener(Autodesk.Viewing.VIEWER_RESIZE_EVENT, onModelLoaded);
        MyVars.viewer.addEventListener(Autodesk.Viewing.EXTENSION_LOADED_EVENT, onModelLoaded);
        MyVars.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, function (event) {
          // Only handle the first item
          var dbId = event.dbIdArray[0];
          showProperties(dbId);
        });
      }
    );
  }
}

function getImageUrl(doc, storyboard) {
  // sample URL
  // https://developer.api.autodesk.com/viewingservice/v1/thumbnails/
  // dXJuOmFkc2sud2lwcHJvZDpmcy5maWxlOnZmLlBvLWM0TzhnU05lVFFXR0RKNFlHN2c_dmVyc2lvbj0x
  // ?guid=%7B%22type%22%3A%22Animation%22%2C%22asset%22%3A%22e70f0521-0478-4734-bc2c-d3fd8f68b497%22%2C%22objectId%22%3A27%7D
  // &width=200&height=200

  var urn = doc.myPath.replace('urn:', '');
  var url = "https://developer.api.autodesk.com/viewingservice/v1/thumbnails/" + urn + "?";

  if (storyboard) {
    var guid = encodeURIComponent(storyboard.viewableID);
    url += "guid=" + guid + "&";
  }

  url += "width=200&height=200";

  return url;
}

function showStoryboards(doc, mainPath) {
  var animations = Autodesk.Viewing.Document.getSubItemsWithProperties(doc.getRootItem(), {
    'type': 'folder',
    'role': 'animation'
  }, true);

  if (animations.length < 1)
    return;

  var animation = animations[0];

  var namesHtml =
    '<div class="storyboardsListItem" path="' + mainPath +
    '">Main model<br /><img class="storyboardsListItemImage" src="' +
    getImageUrl(doc) + '" /></div>';

  for (var id in animation.children) {
    var storyboard = animation.children[id];
    var path = doc.getViewablePath(storyboard);
    var imageUrl = getImageUrl(doc, storyboard);
    namesHtml += '<div class="storyboardsListItem" path="' + path + '">' + storyboard.name +
      '<br /><img class="storyboardsListItemImage" src="' + imageUrl + '" /></div>';
  }

  $('#storyboardsList').html(namesHtml);
  $('.storyboardsListItem').click(onClickStoryboard);
}

function onClickStoryboard(event) {
  var path = event.currentTarget.attributes['path'].value;
  var imageUrl = event.currentTarget.children[1].src;

  clearViewer();

  MyVars.viewer.loadModel(path, {}, onModelLoaded);

  $('#storyboardMessageTxt').html('My message for ' + event.currentTarget.textContent);
  $('#storyboardMessageImage').attr("src", imageUrl);

  // Hide the storyboardsList
  toggleStoryboardsList();
}


function onModelLoaded(model) {
  // Orbit, Pan, Zoom, Explode Model, Settings, Full-screen
  var allowedButtons = [
    'toolbar-orbitTools',
    'toolbar-panTool',
    'toolbar-zoomTool',
    'toolbar-explodeTool',
    'toolbar-settingsTool',
    'toolbar-fullscreenTool',
    'toolbar-animationPlay'
  ];

  var toolbar = MyVars.viewer.getToolbar();
  var controlNum = toolbar.getNumberOfControls();
  for (var id = 0; id < controlNum; id++) {
    var controlId = toolbar.getControlId(id);
    var control = toolbar.getControl(controlId);

    var subControlNum = control.getNumberOfControls()
    for (var subId = 0; subId < subControlNum; subId) {
      var subControlId = control.getControlId(subId);

      // If this control is not listed as allowed, then remove it
      if (allowedButtons.indexOf(subControlId) === -1) {
        control.removeControl(subControlId);
        subControlNum--
      } else {
        subId++
      }
    }
  }
}

function loadDocument(viewer, documentId) {
  // Set the Environment to "Riverbank"
  viewer.setLightPreset(8);

  // Make sure that the loaded document's setting won't
  // override it and change it to something else
  viewer.prefs.tag('ignore-producer');

  Autodesk.Viewing.Document.load(
    documentId,
    // onLoad
    function (doc) {
      var geometryItems = [];
      // Try 3d geometry first
      geometryItems = Autodesk.Viewing.Document.getSubItemsWithProperties(doc.getRootItem(), {
        'type': 'geometry',
        'role': '3d'
      }, true);

      // If no 3d then try 2d
      if (geometryItems.length < 1)
        geometryItems = Autodesk.Viewing.Document.getSubItemsWithProperties(doc.getRootItem(), {
          'type': 'geometry',
          'role': '2d'
        }, true);

      if (geometryItems.length > 0) {
        var path = doc.getViewablePath(geometryItems[0]);
        var options = {};
        viewer.loadModel(path, options, onModelLoaded);
        showStoryboards(doc, path);
      }
    },
    // onError
    function (errorMsg) {
      //showThumbnail(documentId.substr(4, documentId.length - 1));
    }
  )
}




