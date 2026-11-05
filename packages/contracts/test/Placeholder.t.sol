// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Placeholder} from "../src/Placeholder.sol";

contract PlaceholderTest is Test {
    function test_deploys() public {
        Placeholder placeholder = new Placeholder();
        assertGt(address(placeholder).code.length, 0);
    }
}
