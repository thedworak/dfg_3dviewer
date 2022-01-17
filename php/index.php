<?php

// This PHP script must be in "SOME_PATH/jsonFile/index.php"

$file = 'sites/default/files/test.txt';

if($_SERVER['REQUEST_METHOD'] === 'POST')
// or if(!empty($_POST))
{
    file_put_contents($file, $_POST["jsonTxt"]);
    //may be some error handeling if you want
}
else if($_SERVER['REQUEST_METHOD'] === 'GET')
// or else if(!empty($_GET))
{
    echo file_get_contents($file);
    //may be some error handeling if you want
}
?>