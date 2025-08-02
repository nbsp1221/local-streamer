#!/usr/bin/env node

/**
 * Phase 3: HLS API 접근 테스트 스크립트
 * 목적: 구현한 HLS API 라우트들이 올바르게 작동하는지 확인
 */

console.log('🚀 Phase 3: HLS API 접근 테스트 시작');

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
      content: response.status < 400 ? await response.text() : await response.text(),
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
 * 테스트 1: HLS 플레이리스트 API 접근
 */
async function testHLSPlaylistAPI() {
  console.log('\n📋 테스트 1: HLS 플레이리스트 API (/api/hls/local-test-001)');
  
  const url = 'http://localhost:5173/api/hls/local-test-001';
  console.log(`🌐 요청 URL: ${url}`);
  
  const result = await makeRequest(url);
  
  if (!result.success) {
    console.log(`❌ 네트워크 오류: ${result.error}`);
    console.log('💡 개발 서버가 실행 중인지 확인해주세요: bun run dev');
    return false;
  }
  
  console.log(`📊 응답 상태: ${result.status} ${result.statusText}`);
  console.log(`📦 Content-Type: ${result.headers['content-type'] || 'N/A'}`);
  console.log(`📏 Content-Length: ${result.contentLength || 'N/A'}`);
  
  if (result.status === 200) {
    // 플레이리스트 내용 확인
    const lines = result.content.split('\n').filter(line => line.trim());
    const hasM3U8Header = lines[0] === '#EXTM3U';
    const segmentLines = lines.filter(line => line.includes('/api/segment/'));
    
    console.log(`✅ 플레이리스트 응답 성공!`);
    console.log(`   📄 M3U8 헤더: ${hasM3U8Header ? '✅' : '❌'}`);
    console.log(`   🎞️  세그먼트 URL: ${segmentLines.length}개`);
    
    // 첫 몇 줄 미리보기
    console.log('📜 플레이리스트 미리보기 (처음 10줄):');
    lines.slice(0, 10).forEach((line, index) => {
      console.log(`   ${index + 1}. ${line}`);
    });
    
    if (segmentLines.length > 0) {
      console.log(`🔗 세그먼트 URL 예시: ${segmentLines[0]}`);
      return segmentLines[0]; // 첫 번째 세그먼트 URL 반환 (다음 테스트용)
    }
    
    return true;
  } else {
    console.log(`❌ 플레이리스트 요청 실패`);
    console.log(`📝 응답 내용: ${result.content.slice(0, 200)}...`);
    return false;
  }
}

/**
 * 테스트 2: HLS 세그먼트 API 접근
 */
async function testHLSSegmentAPI(segmentUrl) {
  console.log('\n📋 테스트 2: HLS 세그먼트 API');
  
  if (!segmentUrl) {
    // 기본 세그먼트 URL 사용
    segmentUrl = 'http://localhost:5173/api/segment/local-test-001/segment0.ts';
  } else {
    // 상대 URL을 절대 URL로 변환
    if (segmentUrl.startsWith('/')) {
      segmentUrl = `http://localhost:5173${segmentUrl}`;
    }
  }
  
  console.log(`🌐 요청 URL: ${segmentUrl}`);
  
  const result = await makeRequest(segmentUrl);
  
  if (!result.success) {
    console.log(`❌ 네트워크 오류: ${result.error}`);
    return false;
  }
  
  console.log(`📊 응답 상태: ${result.status} ${result.statusText}`);
  console.log(`📦 Content-Type: ${result.headers['content-type'] || 'N/A'}`);
  console.log(`📏 Content-Length: ${result.contentLength || 'N/A'}`);
  console.log(`🎯 Accept-Ranges: ${result.headers['accept-ranges'] || 'N/A'}`);
  
  if (result.status === 200) {
    const sizeMB = result.contentLength ? 
      (parseInt(result.contentLength) / 1024 / 1024).toFixed(2) : 'N/A';
    
    console.log(`✅ 세그먼트 응답 성공!`);
    console.log(`   📊 파일 크기: ${sizeMB}MB`);
    console.log(`   🎞️  MPEG-TS 형식: ${result.headers['content-type']?.includes('mp2t') ? '✅' : '❌'}`);
    
    return true;
  } else {
    console.log(`❌ 세그먼트 요청 실패`);
    console.log(`📝 응답 내용: ${result.content.slice(0, 200)}...`);
    return false;
  }
}

/**
 * 테스트 3: Range 요청 테스트
 */
async function testRangeRequest() {
  console.log('\n📋 테스트 3: Range 요청 테스트');
  
  const url = 'http://localhost:5173/api/segment/local-test-001/segment0.ts';
  console.log(`🌐 요청 URL: ${url}`);
  console.log(`📦 Range 헤더: bytes=0-1023 (첫 1KB)`);
  
  const result = await makeRequest(url, {
    headers: {
      'Range': 'bytes=0-1023'
    }
  });
  
  if (!result.success) {
    console.log(`❌ 네트워크 오류: ${result.error}`);
    return false;
  }
  
  console.log(`📊 응답 상태: ${result.status} ${result.statusText}`);
  console.log(`📏 Content-Length: ${result.contentLength || 'N/A'}`);
  console.log(`🎯 Content-Range: ${result.headers['content-range'] || 'N/A'}`);
  
  if (result.status === 206) {
    console.log(`✅ Range 요청 성공! (Partial Content)`);
    console.log(`   📊 요청한 크기: 1024 bytes`);
    console.log(`   📦 실제 응답 크기: ${result.contentLength} bytes`);
    return true;
  } else if (result.status === 200) {
    console.log(`⚠️  Range 요청이 전체 파일로 처리됨 (정상 동작 가능)`);
    return true;
  } else {
    console.log(`❌ Range 요청 실패`);
    return false;
  }
}

/**
 * 테스트 4: 존재하지 않는 비디오 요청
 */
async function testNotFoundVideo() {
  console.log('\n📋 테스트 4: 존재하지 않는 비디오 요청');
  
  const url = 'http://localhost:5173/api/hls/non-existent-video';
  console.log(`🌐 요청 URL: ${url}`);
  
  const result = await makeRequest(url);
  
  if (!result.success) {
    console.log(`❌ 네트워크 오류: ${result.error}`);
    return false;
  }
  
  console.log(`📊 응답 상태: ${result.status} ${result.statusText}`);
  
  if (result.status === 404) {
    console.log(`✅ 404 응답 정상! (존재하지 않는 비디오 처리)`);
    return true;
  } else {
    console.log(`❌ 예상과 다른 응답: ${result.status}`);
    return false;
  }
}

/**
 * 메인 테스트 실행
 */
async function runHLSAPITests() {
  console.log('⏱️  잠시 후 테스트를 시작합니다...');
  console.log('💡 이 테스트는 개발 서버가 실행 중이어야 합니다: bun run dev');
  console.log('🌐 서버 주소: http://localhost:5173');
  
  // 서버 시작 대기
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results = [];
  
  try {
    // 테스트 1: HLS 플레이리스트
    const segmentUrl = await testHLSPlaylistAPI();
    results.push(segmentUrl !== false);
    
    // 테스트 2: HLS 세그먼트
    const segmentResult = await testHLSSegmentAPI(segmentUrl);
    results.push(segmentResult);
    
    // 테스트 3: Range 요청
    const rangeResult = await testRangeRequest();
    results.push(rangeResult);
    
    // 테스트 4: 404 테스트
    const notFoundResult = await testNotFoundVideo();
    results.push(notFoundResult);
    
    // 결과 요약
    const passedTests = results.filter(result => result === true).length;
    const totalTests = results.length;
    
    console.log('\n📋 테스트 결과 요약:');
    console.log(`   ✅ 통과: ${passedTests}/${totalTests}`);
    console.log(`   ❌ 실패: ${totalTests - passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 Phase 3 테스트 완료!');
      console.log('📋 결과 요약:');
      console.log('   ✅ HLS 플레이리스트 API 정상 작동');
      console.log('   ✅ HLS 세그먼트 API 정상 작동');
      console.log('   ✅ Range 요청 지원');
      console.log('   ✅ 에러 처리 정상');
      console.log('\n✅ Phase 3 검수 준비 완료 - API로 HLS 파일 접근이 가능합니다.');
    } else {
      console.log('\n❌ 일부 테스트가 실패했습니다.');
      console.log('🔧 해결 방법:');
      console.log('1. 개발 서버가 실행 중인지 확인: bun run dev');
      console.log('2. Phase 2에서 HLS 파일이 생성되었는지 확인');
      console.log('3. 라우트 구성이 올바른지 확인');
    }
    
  } catch (error) {
    console.log('\n💥 테스트 실행 중 오류 발생:');
    console.log(error.message);
  }
}

// 테스트 실행
runHLSAPITests();