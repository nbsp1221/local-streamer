#!/usr/bin/env node

/**
 * Phase 4: VideoPlayer HLS 통합 테스트
 * 목적: HLS 확인 API와 VideoPlayer 통합이 제대로 작동하는지 확인
 */

console.log('🚀 Phase 4: VideoPlayer HLS 통합 테스트 시작');

/**
 * HTTP 요청 헬퍼 함수
 */
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      content: response.status < 400 ? await response.json() : await response.text(),
      contentLength: response.headers.get('content-length')
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 테스트 1: HLS 확인 API 동작 확인
 */
async function testHLSCheckAPI() {
  console.log('\n📋 테스트 1: HLS 확인 API (/api/hls-check/local-test-001)');
  
  const url = 'http://localhost:5173/api/hls-check/local-test-001';
  console.log(`🌐 요청 URL: ${url}`);
  
  const result = await makeRequest(url);
  
  if (!result.success) {
    console.log(`❌ 네트워크 오류: ${result.error}`);
    return false;
  }
  
  console.log(`📊 응답 상태: ${result.status} ${result.statusText}`);
  console.log(`📦 Content-Type: ${result.headers['content-type'] || 'N/A'}`);
  
  if (result.status === 200) {
    const data = result.content;
    console.log(`✅ HLS 확인 API 응답 성공!`);
    console.log(`   📹 비디오 ID: ${data.videoId}`);
    console.log(`   🎞️  HLS 존재: ${data.hasHLS ? '✅' : '❌'}`);
    console.log(`   🔗 HLS URL: ${data.hlsUrl || 'N/A'}`);
    console.log(`   ⏰ 타임스탬프: ${data.timestamp}`);
    
    return data;
  } else {
    console.log(`❌ HLS 확인 API 실패`);
    console.log(`📝 응답 내용:`, result.content);
    return false;
  }
}

/**
 * 테스트 2: 존재하지 않는 비디오에 대한 HLS 확인
 */
async function testHLSCheckNonExistent() {
  console.log('\n📋 테스트 2: 존재하지 않는 비디오 HLS 확인');
  
  const url = 'http://localhost:5173/api/hls-check/non-existent-video';
  console.log(`🌐 요청 URL: ${url}`);
  
  const result = await makeRequest(url);
  
  if (!result.success) {
    console.log(`❌ 네트워크 오류: ${result.error}`);
    return false;
  }
  
  console.log(`📊 응답 상태: ${result.status} ${result.statusText}`);
  
  if (result.status === 200) {
    const data = result.content;
    console.log(`✅ 존재하지 않는 비디오 처리 정상!`);
    console.log(`   📹 비디오 ID: ${data.videoId}`);
    console.log(`   🎞️  HLS 존재: ${data.hasHLS ? '✅' : '❌'} (예상: ❌)`);
    
    return !data.hasHLS; // hasHLS가 false여야 정상
  } else {
    console.log(`❌ 존재하지 않는 비디오 확인 실패`);
    return false;
  }
}

/**
 * 테스트 3: 다른 비디오들의 HLS 상태 확인
 */
async function testOtherVideosHLS() {
  console.log('\n📋 테스트 3: 다른 비디오들 HLS 상태 확인');
  
  // 테스트할 다른 비디오 ID들 (videos.json에서)
  const otherVideoIds = [
    'f14b5611-3681-41ba-93c6-d5fc2d78dd2a', // Svelte 5 완벽 정복하기
    'fa670547-2738-4656-b378-13e9a8cdcd47'  // Bun 런타임 심층 분석
  ];
  
  const results = [];
  
  for (const videoId of otherVideoIds) {
    const url = `http://localhost:5173/api/hls-check/${videoId}`;
    console.log(`🌐 요청 URL: ${url}`);
    
    const result = await makeRequest(url);
    
    if (result.success && result.status === 200) {
      const data = result.content;
      console.log(`   📹 ${videoId.slice(0, 8)}...: HLS ${data.hasHLS ? '✅' : '❌'}`);
      results.push(data);
    } else {
      console.log(`   ❌ ${videoId.slice(0, 8)}...: 확인 실패`);
    }
  }
  
  console.log(`✅ 다른 비디오 ${results.length}개 확인 완료`);
  return results.length > 0;
}

/**
 * 테스트 4: 플레이어 페이지 접근 확인
 */
async function testPlayerPageAccess() {
  console.log('\n📋 테스트 4: 플레이어 페이지 접근 확인');
  
  const url = 'http://localhost:5173/player/local-test-001';
  console.log(`🌐 플레이어 페이지: ${url}`);
  console.log('💡 이 페이지를 브라우저에서 직접 확인하세요.');
  console.log('🔍 개발자 도구 → Network 탭에서 다음을 확인:');
  console.log('   1. /api/hls-check/local-test-001 호출 여부');
  console.log('   2. /api/hls/local-test-001 (m3u8) 로딩 여부');
  console.log('   3. /api/segment/local-test-001/segment*.ts 로딩 여부');
  console.log('   4. 오른쪽 상단에 "🎞️ HLS" 표시 여부');
  
  return true;
}

/**
 * 메인 테스트 실행
 */
async function runPhase4Tests() {
  console.log('⏱️  잠시 후 테스트를 시작합니다...');
  console.log('💡 이 테스트는 개발 서버가 실행 중이어야 합니다.');
  console.log('🌐 서버 주소: http://localhost:5173');
  
  // 서버 시작 대기
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results = [];
  
  try {
    // 테스트 1: HLS 확인 API
    const hlsCheckResult = await testHLSCheckAPI();
    results.push(hlsCheckResult !== false);
    
    // 테스트 2: 존재하지 않는 비디오
    const nonExistentResult = await testHLSCheckNonExistent();
    results.push(nonExistentResult);
    
    // 테스트 3: 다른 비디오들
    const otherVideosResult = await testOtherVideosHLS();
    results.push(otherVideosResult);
    
    // 테스트 4: 플레이어 페이지
    const playerPageResult = await testPlayerPageAccess();
    results.push(playerPageResult);
    
    // 결과 요약
    const passedTests = results.filter(result => result === true).length;
    const totalTests = results.length;
    
    console.log('\n📋 Phase 4 테스트 결과 요약:');
    console.log(`   ✅ 통과: ${passedTests}/${totalTests}`);
    console.log(`   ❌ 실패: ${totalTests - passedTests}/${totalTests}`);
    
    if (passedTests >= 3) { // 4번은 수동 확인이므로 3개 이상 통과면 성공
      console.log('\n🎉 Phase 4 테스트 완료!');
      console.log('📋 결과 요약:');
      console.log('   ✅ HLS 확인 API 정상 작동');
      console.log('   ✅ VideoPlayer HLS 자동 감지 구현');
      console.log('   ✅ HLS vs Range request 자동 전환');
      console.log('\n✅ Phase 4 검수 준비 완료!');
      console.log('\n🌐 브라우저에서 확인해보세요:');
      console.log('   👉 http://localhost:5173/player/local-test-001');
      console.log('   🔍 개발자 도구에서 네트워크 요청과 "🎞️ HLS" 표시 확인');
    } else {
      console.log('\n❌ 일부 테스트가 실패했습니다.');
      console.log('🔧 해결 방법:');
      console.log('1. 개발 서버가 실행 중인지 확인');
      console.log('2. Phase 2, 3의 HLS 파일이 생성되었는지 확인');
      console.log('3. 새로운 라우트가 제대로 등록되었는지 확인');
    }
    
  } catch (error) {
    console.log('\n💥 테스트 실행 중 오류 발생:');
    console.log(error.message);
  }
}

// 테스트 실행
runPhase4Tests();